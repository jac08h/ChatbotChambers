export type DeploymentMode = "local" | "hosted";

export const deploymentMode: DeploymentMode =
    import.meta.env.VITE_DEPLOYMENT_MODE === "hosted" ? "hosted" : "local";

export const isHostedMode = deploymentMode === "hosted";
