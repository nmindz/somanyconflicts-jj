export namespace Constants {
  export const conflictMarkerStart: string = '<<<<<<<'
  export const conflictMarkerDiff: string = '%%%%%%%'
  export const conflictMarkerDiffDesc: string = '\\\\\\\\\\\\\\' // 7 literal backslashes
  export const conflictMarkerLiteral: string = '+++++++'
  export const conflictMarkerEnd: string = '>>>>>>>'

  export const conflictStartPattern: RegExp =
    /^<{7}\s+[Cc]onflict\s+(\d+)\s+of\s+(\d+)/
  export const conflictEndPattern: RegExp =
    /^>{7}\s+[Cc]onflict\s+(\d+)\s+of\s+(\d+)\s+ends/
}
