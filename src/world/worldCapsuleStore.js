import { fixtureWorldCapsules } from './worldCapsules.js';

export class WorldCapsuleStore {
  constructor(seedCapsules = fixtureWorldCapsules, random = Math.random) {
    this.random = random;
    this.capsules = [...seedCapsules];
    this.recentIds = [];
  }

  pick() {
    if (!this.capsules.length) throw new Error('No WorldCapsules available');
    const recent = new Set(this.recentIds.slice(-3));
    const eligible = this.capsules.filter(c => !recent.has(c.id));
    const pool = eligible.length ? eligible : this.capsules;
    const chosen = pool[Math.floor(this.random() * pool.length)];
    this.recentIds.push(chosen.id);
    if (this.recentIds.length > 12) this.recentIds.shift();
    return chosen;
  }
}
