// Phase-1 fixtures. They establish the contract used later by a real WorldBrowseTool.
// Capsules are deliberately ordinary and spatially varied; they are not prose templates.
export const fixtureWorldCapsules = [
  {
    id: 'iowa-family-farm',
    spatialSeed: 'a family farm in the American Midwest',
    broaderRegion: 'Iowa, United States',
    groundingDetails: ['machine shed', 'grain bins', 'county road', 'repair parts', 'farm bookkeeping'],
    ordinaryLifePossibilities: ['equipment repair', 'late bookkeeping', 'bringing food out during work'],
    avoidCliches: ['flags', 'cowboy imagery', 'rural nostalgia']
  },
  {
    id: 'bengaluru-pharmacy',
    spatialSeed: 'a neighborhood pharmacy on a residential street',
    broaderRegion: 'Bengaluru, India',
    groundingDetails: ['metal shutters', 'fluorescent shelving', 'delivery cartons', 'apartment blocks', 'two-wheelers outside'],
    ordinaryLifePossibilities: ['closing stock count', 'changing a tube light', 'sorting a late delivery'],
    avoidCliches: ['slums', 'cricket', 'tabla', 'temple imagery as default']
  },
  {
    id: 'ohrid-lake-service-pier',
    spatialSeed: 'a small service pier on a clear mountain lake',
    broaderRegion: 'Lake Ohrid, North Macedonia',
    groundingDetails: ['clear water', 'small work boats', 'stone shoreline', 'tool crates', 'steep hills beyond the water'],
    ordinaryLifePossibilities: ['moving supplies', 'untangling mooring rope', 'checking an outboard motor'],
    avoidCliches: ['travel-brochure language', 'romanticized old-Europe framing']
  },
  {
    id: 'kaohsiung-industrial-edge',
    spatialSeed: 'an industrial district at the edge of a port city',
    broaderRegion: 'Kaohsiung, Taiwan',
    groundingDetails: ['small factories', 'freight traffic', 'scooters', 'dense utility infrastructure', 'worker restaurants'],
    ordinaryLifePossibilities: ['loading parts', 'repairing a roller door', 'sorting mislabeled pallets'],
    avoidCliches: ['neon city imagery', 'temples', 'night-market shorthand']
  },
  {
    id: 'andes-mountain-road',
    spatialSeed: 'a maintenance turnout on a high mountain road',
    broaderRegion: 'Andes, South America',
    groundingDetails: ['rock cut', 'guardrail', 'thin roadside vegetation', 'maintenance truck', 'long drop into a valley'],
    ordinaryLifePossibilities: ['clearing loose stone', 'checking a damaged sign', 'waiting for a machine to restart'],
    avoidCliches: ['mystical mountain language', 'tourist panorama framing']
  },
  {
    id: 'maputo-office-cleaning',
    spatialSeed: 'a nearly empty office floor after closing',
    broaderRegion: 'Maputo, Mozambique',
    groundingDetails: ['glass partitions', 'utility cart', 'open-plan desks', 'service corridor', 'street glow through windows'],
    ordinaryLifePossibilities: ['cleaning staff trading tasks', 'someone finishing late work', 'a stubborn copier jam'],
    avoidCliches: ['generic poverty imagery', 'performative cultural markers']
  },
  {
    id: 'finland-lake-ferry',
    spatialSeed: 'the vehicle deck of a small lake ferry',
    broaderRegion: 'Finland',
    groundingDetails: ['painted steel deck', 'short vehicle queue', 'lake wind', 'safety chains', 'engine vibration'],
    ordinaryLifePossibilities: ['deckhand securing a gate', 'driver searching for a dropped key', 'crew moving supplies'],
    avoidCliches: ['sauna', 'aurora', 'Nordic minimalism clichés']
  },
  {
    id: 'surabaya-warehouse-lane',
    spatialSeed: 'a warehouse lane in a dense industrial area',
    broaderRegion: 'Surabaya, Indonesia',
    groundingDetails: ['roller shutters', 'delivery trucks', 'concrete drains', 'stacked cartons', 'small food stalls nearby'],
    ordinaryLifePossibilities: ['repacking a damaged shipment', 'arguing over a manifest', 'moving a pallet by hand'],
    avoidCliches: ['tropical paradise imagery', 'tourism language']
  }
];

export function pickFixtureWorldCapsule(random = Math.random) {
  return fixtureWorldCapsules[Math.floor(random() * fixtureWorldCapsules.length)];
}
