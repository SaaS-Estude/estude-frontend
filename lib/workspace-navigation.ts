export const WORKSPACE_NAVIGATION_EVENT = "estude:workspace-navigation";

export function requestWorkspaceNavigation(action: () => void) {
  const event = new CustomEvent<{ action: () => void }>(
    WORKSPACE_NAVIGATION_EVENT,
    {
      cancelable: true,
      detail: { action },
    },
  );
  if (window.dispatchEvent(event)) action();
}
