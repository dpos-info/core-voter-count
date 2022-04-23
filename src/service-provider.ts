import { Providers } from "@arkecosystem/core-kernel";

import { Service } from "./service";

export class ServiceProvider extends Providers.ServiceProvider {
    private service = Symbol.for("Service<VoterCount>");

    public async register(): Promise<void> {
        if (this.config().get("enabled")) {
            this.app.bind<Service>(this.service).to(Service).inSingletonScope();

            this.app.get<Service>(this.service).register();
        }
    }

    public async bootWhen(): Promise<boolean> {
        return !!this.config().get("enabled");
    }

    public async boot(): Promise<void> {
        this.app.get<Service>(this.service).boot();
    }

    public async dispose(): Promise<void> {
        if (this.config().get("enabled")) {
            this.app.get<Service>(this.service).dispose();
        }
    }
}
