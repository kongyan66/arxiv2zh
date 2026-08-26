type LibrarySelectionPane = {
  getSelectedLibraryID?: () => number | undefined;
  getSelectedLibraryIDs?: () => number[];
};

export function selectedLibraryID(
  pane: LibrarySelectionPane | undefined,
): number | undefined {
  if (!pane) return undefined;

  const selectedLibraryIDs = pane.getSelectedLibraryIDs?.();
  if (selectedLibraryIDs?.length === 1) return selectedLibraryIDs[0];
  if (selectedLibraryIDs && selectedLibraryIDs.length !== 1) return undefined;

  return pane.getSelectedLibraryID?.();
}
