import { AuthPreviewOperateScope, type BrowserProfile } from "@t3tools/contracts";
import { useEffect } from "react";

import { useClientSettings, useClientSettingsHydrated } from "~/hooks/useSettings";
import { useProjects, useServerConfigs } from "~/state/entities";
import { useEnvironments } from "~/state/environments";
import { previewEnvironment } from "~/state/preview";
import { useEnvironmentsWithScope } from "~/state/session";
import { derivePhysicalProjectKey } from "~/logicalProject";
import { useAtomCommand } from "~/state/use-atom-command";

const selectProfiles = (settings: { readonly browserProfiles: ReadonlyArray<BrowserProfile> }) =>
  settings.browserProfiles;
const selectProjectProfileIds = (settings: {
  readonly browserProjectProfileIds: Readonly<Record<string, string>>;
}) => settings.browserProjectProfileIds;
const selectDefaultProfileId = (settings: { readonly browserDefaultProfileId: string }) =>
  settings.browserDefaultProfileId;

/**
 * Tells each environment that hosts browser tabs which profiles this client
 * has, so agents can open tabs under them. Profiles live in client settings;
 * the server keeps only the latest report in memory. A reconnect brings a new
 * server config, which sends the report again.
 */
export function BrowserProfileReporter() {
  const hydrated = useClientSettingsHydrated();
  const profiles = useClientSettings(selectProfiles);
  const defaultProfileId = useClientSettings(selectDefaultProfileId);
  const projectProfileIds = useClientSettings(selectProjectProfileIds);
  const projects = useProjects();
  const { environments } = useEnvironments();
  const serverConfigs = useServerConfigs();
  const operable = useEnvironmentsWithScope(environments, AuthPreviewOperateScope);
  const report = useAtomCommand(previewEnvironment.reportProfiles, { reportFailure: false });

  useEffect(() => {
    if (!hydrated) return;
    for (const [environmentId, config] of serverConfigs) {
      if (!config.environment.capabilities.serverBrowser || !operable.has(environmentId)) continue;
      void report({
        environmentId,
        input: {
          profiles,
          defaultProfileId,
          projectProfileIds: Object.fromEntries(
            projects.flatMap((project) => {
              const profileId = projectProfileIds[derivePhysicalProjectKey(project)];
              return project.environmentId === environmentId && profileId !== undefined
                ? [[project.id, profileId] as const]
                : [];
            }),
          ),
        },
      });
    }
  }, [
    defaultProfileId,
    hydrated,
    operable,
    profiles,
    projectProfileIds,
    projects,
    report,
    serverConfigs,
  ]);

  return null;
}
