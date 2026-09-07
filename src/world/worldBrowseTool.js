/**
 * Runtime boundary for future browsing.
 * A production implementation should perform shallow, bounded discovery and return a compact WorldCapsule.
 * Phase 1 intentionally does not browse on the request path.
 */
export class WorldBrowseTool {
  async discoverWorldCapsule() {
    throw new Error('WorldBrowseTool.discoverWorldCapsule() is not configured');
  }
}
