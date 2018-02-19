// Type definitions for dependency.json
// Definitions by: Umoxfo <https://github.com/Umoxfo>

declare module "*.json" {
    interface JSON {
        JRE: JRE;
    }

    interface JRE {
        version: string;
        product_version: string;
        build_number: string;
        hash: string;
    }

    const value: JSON;
    export = value;
}
