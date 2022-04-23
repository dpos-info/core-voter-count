import { Identifiers as ApiIdentifiers, Resources, Server } from "@arkecosystem/core-api";
import { Container, Contracts, Enums as AppEnums, Services } from "@arkecosystem/core-kernel";
import { Enums } from "@arkecosystem/crypto";

type ExtendedDelegateResource = {
    voterCount?: number;
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

        if (!this.attributeSet.has("delegate.voterCount")) {
            this.attributeSet.set("delegate.voterCount");
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
        if (this.attributeSet.has("delegate.voterCount")) {
            this.attributeSet.forget("delegate.voterCount");
        }
    }

    private extendDelegatesApi(server: Server): void {
        const transform = (delegate: ExtendedDelegateResource) => {
            const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(delegate.publicKey);
            delegate.voterCount = delegateWallet.getAttribute("delegate.voterCount", 0);
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

                return {
                    ...originalResponse,
                    data: transform(originalResponse.data),
                };
            };
        }
    }

    private async handleBuilderFinished(): Promise<void> {
        for (const [index, voter] of this.walletRepository.allByPublicKey().entries()) {
            if (voter.hasVoted()) {
                const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(voter.getAttribute("vote"));

                if (index === 0 && delegateWallet.hasAttribute("delegate.voterCount") && delegateWallet.getAttribute("delegate.voterCount") !== undefined) {
                    break;
                }

                const voterCount: number = delegateWallet.getAttribute("delegate.voterCount", 0);
                delegateWallet.setAttribute("delegate.voterCount", voterCount + 1);
            }
        }
    }

    private handleTransaction({ data }, revert = false): void {
        if (data.typeGroup === Enums.TransactionTypeGroup.Core) {
            if (data.type === Enums.TransactionType.DelegateRegistration) {
                this.handleDelegateRegistration(data.senderPublicKey, revert);
            } else if (data.type === Enums.TransactionType.Vote) {
                this.handleVote(data.asset.votes, revert);
            }
        }
    }

    private handleDelegateRegistration(senderPublicKey, revert): void {
        const delegate: Contracts.State.Wallet = this.walletRepository.findByPublicKey(senderPublicKey);

        if (revert) {
            delegate.forgetAttribute("delegate.voterCount");
        } else {
            delegate.setAttribute("delegate.voterCount", 0);
        }
    }

    private handleVote(votes, revert): void {
        for (const vote of votes) {
            const delegateWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(vote.slice(1));
            let voterCount: number = delegateWallet.getAttribute("delegate.voterCount", 0);

            if (vote.startsWith("+")) {
                voterCount = voterCount + (revert ? -1 : 1);
            } else {
                voterCount = voterCount - (revert ? -1 : 1);
            }

            delegateWallet.setAttribute("delegate.voterCount", voterCount);
        }
    }

    private log(message: string, type: "info" | "error" = "info") {
        this.logger[type](`[@dpos-info/voter-count] ${message}`);
    }
}
