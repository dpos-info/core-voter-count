import { Identifiers as ApiIdentifiers, Resources, Server } from "@arkecosystem/core-api";
import { Container, Contracts, Enums as AppEnums, Services } from "@arkecosystem/core-kernel";
import { Enums } from "@arkecosystem/crypto";

type ExtendedDelegateResource = {
    voters?: number;
} & Resources.DelegateResource;

@Container.injectable()
export class Service {
    @Container.inject(Container.Identifiers.WalletAttributes)
    private readonly attributeSet!: Services.Attributes.AttributeSet;

    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async register(): Promise<void> {
        this.log("Registering Plugin");

        if (!this.attributeSet.has("delegate.voters")) {
            this.attributeSet.set("delegate.voters");
        }

        this.events.listen(AppEnums.StateEvent.BuilderFinished, {
            handle: () => {
                this.handleBuilderFinished();
            },
        });

        this.events.listen(AppEnums.TransactionEvent.Applied, {
            handle: (data) => {
                this.handleTransaction(data);
            },
        });

        this.events.listen(AppEnums.TransactionEvent.Reverted, {
            handle: (data) => {
                this.handleTransaction(data, true);
            },
        });
    }

    public async boot(): Promise<void> {
        this.log("Booting Plugin");

        const server: Server = this.app.get<Server>(ApiIdentifiers.HTTP);

        this.extendDelegatesApi(server);
    }

    public dispose(): void {
        if (this.attributeSet.has("delegate.voters")) {
            this.attributeSet.forget("delegate.voters");
        }
    }

    private extendDelegatesApi(server: Server): void {
        const transform = (delegate: ExtendedDelegateResource) => {
            const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(delegate.publicKey);
            delegate.voters = delegateWallet.getAttribute("delegate.voters", 0);
            return delegate;
        };

        const delegatesIndexRoute = server.getRoute("GET", "/api/delegates");
        const delegatesShowRoute = server.getRoute("GET", "/api/delegates/{id}");

        if (delegatesIndexRoute) {
            const originalDelegatesRouteHandler = delegatesIndexRoute.settings.handler;

            delegatesIndexRoute.settings.handler = async (request) => {
                // @ts-ignore
                const originalResponse = await originalDelegatesRouteHandler(request);

                const { results, totalCount, meta } = originalResponse;

                return {
                    meta,
                    results: results.map(transform),
                    totalCount,
                };
            };
        }

        if (delegatesShowRoute) {
            const originalDelegatesRouteHandler = delegatesShowRoute.settings.handler;

            delegatesShowRoute.settings.handler = async (request) => {
                // @ts-ignore
                const originalResponse = await originalDelegatesRouteHandler(request);

                if (originalResponse.data) {
                    return {
                        ...originalResponse,
                        data: transform(originalResponse.data),
                    };
                }

                return originalResponse;
            };
        }
    }

    private async handleBuilderFinished(): Promise<void> {
        let first = true;

        for (const voter of this.walletRepository.allByPublicKey()) {
            if (voter.hasVoted()) {
                const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(voter.getAttribute("vote"));

                if (first && delegateWallet.hasAttribute("delegate.voters") && delegateWallet.getAttribute("delegate.voters") !== undefined) {
                    break;
                }

                const voters: number = delegateWallet.getAttribute("delegate.voters", 0);
                delegateWallet.setAttribute("delegate.voters", voters + 1);

                first = false;
            }
        }
    }

    private handleTransaction({ data }, revert = false): void {
        const isVote = (type: number, typeGroup: number) => {
            if (typeGroup === Enums.TransactionTypeGroup.Core && (type === (Enums.TransactionType as any).Core?.Vote || type === Enums.TransactionType.Vote)) {
                return true;
            }

            return false;
        };

        if (isVote(data.type, data.typeGroup)) {
            this.handleVote(data.asset.votes, revert);
        }
    }

    private handleVote(votes, revert): void {
        for (const vote of votes) {
            let delegateWallet: Contracts.State.Wallet;

            const identifier = vote.slice(1);

            if (identifier.length === 66) {
                delegateWallet = this.walletRepository.findByPublicKey(identifier);
            } else {
                delegateWallet = this.walletRepository.findByUsername(identifier);
            }

            let voters: number = delegateWallet.getAttribute("delegate.voters", 0);

            if (vote.startsWith("+")) {
                voters = voters + (revert ? -1 : 1);
            } else {
                voters = voters - (revert ? -1 : 1);
            }

            this.log(`Setting ${delegateWallet.getAttribute("delegate.username")} voters to ${voters}`, "debug");

            delegateWallet.setAttribute("delegate.voters", voters);
        }
    }

    private log(message: string, type: "debug" | "info" | "error" = "info") {
        this.logger[type](`[@dpos-info/voter-count] ${message}`);
    }
}
