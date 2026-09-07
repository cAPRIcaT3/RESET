export const FIXTURE_SCENES = Object.freeze([
  {
    capsuleId: 'iowa-family-farm',
    sceneTime: '05:47',
    voice: 'am_michael',
    scene: 'The tractor is already half apart when the coffee arrives. A father holds a work light under the rear axle while his daughter reads part numbers from a grease-marked phone. On the kitchen window behind them, someone has taped next season’s seed invoice where nobody can avoid seeing it. The missing washer turns up inside a glove.'
  },
  {
    capsuleId: 'bengaluru-pharmacy',
    sceneTime: '21:16',
    voice: 'af_nicole',
    scene: 'One shutter is down and the other refuses to follow. Inside the pharmacy, cartons from a late delivery occupy the aisle while two employees count strips of tablets into neat towers. A scooter horn sounds outside. The owner taps the stubborn shutter with a broom handle, considers it, and goes back to the inventory sheet.'
  },
  {
    capsuleId: 'ohrid-lake-service-pier',
    sceneTime: '07:28',
    voice: 'am_michael',
    scene: 'A yellow crate hits the deck harder than intended and three screws jump into the lake. Nobody says anything for a second. Then one crew member lies flat on the pier with a magnet tied to blue cord while another keeps the boat from drifting away. Below them, the water is clear enough to make failure look almost convenient.'
  },
  {
    capsuleId: 'kaohsiung-industrial-edge',
    sceneTime: '14:42',
    voice: 'af_nicole',
    scene: 'The pallet is labeled correctly; everything on it is wrong. Four warehouse workers stand around twelve identical cartons, opening one after another and comparing metal fittings against a phone photograph. A roller door rattles halfway down, stops, and rises again. Nobody looks up. By carton seven, somebody has found a marker and begun rewriting the entire shipment.'
  },
  {
    capsuleId: 'andes-mountain-road',
    sceneTime: '16:58',
    voice: 'am_michael',
    scene: 'Loose stone keeps sliding onto the turnout faster than the maintenance crew can shovel it away. One worker braces a bent road sign against the truck while another tests the generator for the third time. The engine coughs, catches, and the portable drill finally starts. Far below, traffic continues through the valley without knowing the sign was ever crooked.'
  },
  {
    capsuleId: 'maputo-office-cleaning',
    sceneTime: '19:37',
    voice: 'af_nicole',
    scene: 'The copier has swallowed an invoice at exactly the wrong hour. A cleaner parks her cart beside it and watches two office workers open every panel they can find. One produces a ruler. The other produces confidence. Neither helps. The cleaner reaches behind the paper tray, removes a crumpled page in three seconds, and rolls away before they can ask how.'
  },
  {
    capsuleId: 'finland-lake-ferry',
    sceneTime: '23:08',
    voice: 'am_michael',
    scene: 'Three cars wait on the vehicle deck while a deckhand searches for a set of keys that should be clipped to his belt. The ferry is already moving. He checks a toolbox, a coil of rope, then the lock itself. A driver points silently at the keys hanging from the gate. The deckhand closes his eyes before going to retrieve them.'
  },
  {
    capsuleId: 'surabaya-warehouse-lane',
    sceneTime: '12:11',
    voice: 'af_nicole',
    scene: 'A torn carton has turned the loading lane into an impromptu counting room. Small machine parts sit in rows on a sheet of cardboard while a driver, two warehouse workers, and the person with the clipboard disagree over whether there should be ninety-six or ninety-eight. A lunch delivery arrives, waits, and is drafted into holding the tape measure.'
  }
]);

export class FixtureSceneProvider {
  kind = 'fixture';

  constructor(random = Math.random) {
    this.random = random;
  }

  async generate({ worldCapsule }) {
    let candidates = FIXTURE_SCENES.filter(f => f.capsuleId === worldCapsule.id);
    if (!candidates.length) candidates = FIXTURE_SCENES;
    const chosen = candidates[Math.floor(this.random() * candidates.length)];
    return {
      scene: chosen.scene,
      requestedVoice: chosen.voice,
      sceneTime: chosen.sceneTime
    };
  }
}
