import { Asset } from "expo-asset";

export interface LibrarySong {
  id: string;
  title: string;
  artist: string;
  cover: number;
  source: number;
  durationMs: number;
}

const COVER_AMBA = require("../../assets/song-imtheone-cover.png");
const COVER_AMBA_MESIENTO_BIEN = require("../../assets/song-amba-mesientobien-cover.jpg");
const COVER_AMBA_MONSTRUOS_EN_MI_CABEZA = require("../../assets/song-amba-monstruosenmicabeza-cover.png");
const COVER_2001_AMBA = require("../../assets/song-2001-amba-cover.jpg");
const COVER_DOLOZOE = require("../../assets/song-dolozoe-cover.png");
const COVER_RRO_DA_RONIN = require("../../assets/song-rro-da-ronin-cover.png");
const COVER_SKYAIR = require("../../assets/song-skyair-cover.jpg");
const COVER_ALEX_DAVID = require("../../assets/song-alex-david-cover.jpg");

const SONG_IMTHEONE: LibrarySong = {
  id: "imtheone",
  title: "I'm The One",
  artist: "Amba",
  cover: COVER_AMBA,
  source: require("../../assets/song-imtheone.m4a"),
  durationMs: 0,
};

const SONG_MESIENTO_BIEN: LibrarySong = {
  id: "amba-mesientobien",
  title: "Me Siento Bien",
  artist: "Amba",
  cover: COVER_AMBA_MESIENTO_BIEN,
  source: require("../../assets/song-amba-mesientobien.m4a"),
  durationMs: 0,
};

const SONG_MONSTRUOS_EN_MI_CABEZA: LibrarySong = {
  id: "amba-monstruosenmicabeza",
  title: "Monstruos En Mi Cabeza",
  artist: "Amba",
  cover: COVER_AMBA_MONSTRUOS_EN_MI_CABEZA,
  source: require("../../assets/song-amba-monstruosenmicabeza.m4a"),
  durationMs: 0,
};

const SONG_2001_AMBA_COMODOMINO: LibrarySong = {
  id: "2001-amba-comodomino",
  title: "comodominó",
  artist: "Amba",
  cover: COVER_2001_AMBA,
  source: require("../../assets/song-2001-amba-comodomino.m4a"),
  durationMs: 0,
};

const SONG_2001_AMBA_DIMEBB: LibrarySong = {
  id: "2001-amba-dimebb",
  title: "dimebb",
  artist: "Amba",
  cover: COVER_2001_AMBA,
  source: require("../../assets/song-2001-amba-dimebb.m4a"),
  durationMs: 0,
};

const SONG_2001_AMBA_LACORRIENTE: LibrarySong = {
  id: "2001-amba-lacorriente",
  title: "lacorriente",
  artist: "Amba",
  cover: COVER_2001_AMBA,
  source: require("../../assets/song-2001-amba-lacorriente.m4a"),
  durationMs: 0,
};

const SONG_DOLOZOE_360: LibrarySong = {
  id: "dolozoe-360",
  title: "360",
  artist: "Dolozoe",
  cover: COVER_DOLOZOE,
  source: require("../../assets/song-dolozoe-360.m4a"),
  durationMs: 0,
};

const SONG_DOLOZOE_RANK: LibrarySong = {
  id: "dolozoe-rank",
  title: "Rank",
  artist: "Dolozoe",
  cover: COVER_DOLOZOE,
  source: require("../../assets/song-dolozoe-rank.m4a"),
  durationMs: 0,
};

const SONG_RRO_DA_RONIN_1234: LibrarySong = {
  id: "rro-da-ronin-1234",
  title: "1234",
  artist: "Rro Da Ronin",
  cover: COVER_RRO_DA_RONIN,
  source: require("../../assets/song-rro-da-ronin-1234.mp3"),
  durationMs: 0,
};

const SONG_RRO_DA_RONIN_HOPES: LibrarySong = {
  id: "rro-da-ronin-hopes",
  title: "Hopes",
  artist: "Rro Da Ronin",
  cover: COVER_RRO_DA_RONIN,
  source: require("../../assets/song-rro-da-ronin-hopes.mp3"),
  durationMs: 0,
};

const SONG_SKYAIR_ANTIHERO: LibrarySong = {
  id: "skyair-antihero",
  title: "AntiHero",
  artist: "skyair",
  cover: COVER_SKYAIR,
  source: require("../../assets/song-skyair-antihero.mp3"),
  durationMs: 0,
};

const SONG_SKYAIR_BUTTER: LibrarySong = {
  id: "skyair-butter",
  title: "Butter",
  artist: "skyair",
  cover: COVER_SKYAIR,
  source: require("../../assets/song-skyair-butter.mp3"),
  durationMs: 0,
};

const SONG_SKYAIR_SILICON_VALLEY: LibrarySong = {
  id: "skyair-silicon-valley",
  title: "Silicon Valley",
  artist: "skyair",
  cover: COVER_SKYAIR,
  source: require("../../assets/song-skyair-silicon-valley.mp3"),
  durationMs: 0,
};

const SONG_ALEX_DAVID_FEVER: LibrarySong = {
  id: "alex-david-fever",
  title: "FEVER",
  artist: "Alex David",
  cover: COVER_ALEX_DAVID,
  source: require("../../assets/song-alex-david-fever.m4a"),
  durationMs: 0,
};

const SONG_ALEX_DAVID_GAMMA_SC_MIX: LibrarySong = {
  id: "alex-david-gamma-sc-mix",
  title: "GAMMA (SC MIX)",
  artist: "Alex David",
  cover: COVER_ALEX_DAVID,
  source: require("../../assets/song-alex-david-gamma-sc-mix.m4a"),
  durationMs: 0,
};

const SONG_ALEX_DAVID_GET_RIGHT_OUTTA_SIGHT_INSTRUMENTAL: LibrarySong = {
  id: "alex-david-get-right-outta-sight-instrumental",
  title: "Get RIGHT!Outta Sight (instrumental)",
  artist: "Alex David",
  cover: COVER_ALEX_DAVID,
  source: require("../../assets/song-alex-david-get-right-outta-sight-instrumental.m4a"),
  durationMs: 0,
};

const SONG_ALEX_DAVID_HIDING_THOUGHT_U_KNEW_BETTER: LibrarySong = {
  id: "alex-david-hiding-thought-u-knew-better",
  title: "Hiding (thought u knew better)",
  artist: "Alex David",
  cover: COVER_ALEX_DAVID,
  source: require("../../assets/song-alex-david-hiding-thought-u-knew-better.m4a"),
  durationMs: 0,
};

const SONG_ALEX_DAVID_LIFE_ALERT_W_MOONLEE: LibrarySong = {
  id: "alex-david-life-alert-w-moonlee",
  title: "Life Alert (w!MoonLee)",
  artist: "Alex David",
  cover: COVER_ALEX_DAVID,
  source: require("../../assets/song-alex-david-life-alert-w-moonlee.m4a"),
  durationMs: 0,
};

const SONG_ALEX_DAVID_MISTAKES_HAPPEN_NOT_LIKE_THIS: LibrarySong = {
  id: "alex-david-mistakes-happen-not-like-this",
  title: "Mistakes happen (not like this)",
  artist: "Alex David",
  cover: COVER_ALEX_DAVID,
  source: require("../../assets/song-alex-david-mistakes-happen-not-like-this.m4a"),
  durationMs: 0,
};

const SONG_ALEX_DAVID_NEW_DAYS_AHEAD: LibrarySong = {
  id: "alex-david-new-days-ahead",
  title: "New Days Ahead",
  artist: "Alex David",
  cover: COVER_ALEX_DAVID,
  source: require("../../assets/song-alex-david-new-days-ahead.m4a"),
  durationMs: 0,
};

const SONG_ALEX_DAVID_OHBAYBAY_ACTUP_W_RONIN: LibrarySong = {
  id: "alex-david-ohbaybay-actup-w-ronin",
  title: "ohbaybay!ACTUP! (w!Ronin)",
  artist: "Alex David",
  cover: COVER_ALEX_DAVID,
  source: require("../../assets/song-alex-david-ohbaybay-actup-w-ronin.m4a"),
  durationMs: 0,
};

const SONG_ALEX_DAVID_PLASTIC_SMILES: LibrarySong = {
  id: "alex-david-plastic-smiles",
  title: "Plastic smiles",
  artist: "Alex David",
  cover: COVER_ALEX_DAVID,
  source: require("../../assets/song-alex-david-plastic-smiles.m4a"),
  durationMs: 0,
};

const SONG_ALEX_DAVID_RUNNIN: LibrarySong = {
  id: "alex-david-runnin",
  title: "RUNNIN'",
  artist: "Alex David",
  cover: COVER_ALEX_DAVID,
  source: require("../../assets/song-alex-david-runnin.m4a"),
  durationMs: 0,
};

const SONG_ALEX_DAVID_WAISTLINE_W_TREVOR_QUINCY: LibrarySong = {
  id: "alex-david-waistline-w-trevor-quincy",
  title: "Waistline (w! Trevor Quincy)",
  artist: "Alex David",
  cover: COVER_ALEX_DAVID,
  source: require("../../assets/song-alex-david-waistline-w-trevor-quincy.m4a"),
  durationMs: 0,
};

export const MUSIC_LIBRARY: LibrarySong[] = [
  SONG_IMTHEONE,
  SONG_MESIENTO_BIEN,
  SONG_MONSTRUOS_EN_MI_CABEZA,
  SONG_2001_AMBA_COMODOMINO,
  SONG_2001_AMBA_DIMEBB,
  SONG_2001_AMBA_LACORRIENTE,
  SONG_DOLOZOE_360,
  SONG_DOLOZOE_RANK,
  SONG_RRO_DA_RONIN_1234,
  SONG_RRO_DA_RONIN_HOPES,
  SONG_SKYAIR_ANTIHERO,
  SONG_SKYAIR_BUTTER,
  SONG_SKYAIR_SILICON_VALLEY,
  SONG_ALEX_DAVID_FEVER,
  SONG_ALEX_DAVID_GAMMA_SC_MIX,
  SONG_ALEX_DAVID_GET_RIGHT_OUTTA_SIGHT_INSTRUMENTAL,
  SONG_ALEX_DAVID_HIDING_THOUGHT_U_KNEW_BETTER,
  SONG_ALEX_DAVID_LIFE_ALERT_W_MOONLEE,
  SONG_ALEX_DAVID_MISTAKES_HAPPEN_NOT_LIKE_THIS,
  SONG_ALEX_DAVID_NEW_DAYS_AHEAD,
  SONG_ALEX_DAVID_OHBAYBAY_ACTUP_W_RONIN,
  SONG_ALEX_DAVID_PLASTIC_SMILES,
  SONG_ALEX_DAVID_RUNNIN,
  SONG_ALEX_DAVID_WAISTLINE_W_TREVOR_QUINCY,
];

export function getSongById(id?: string | null) {
  if (!id) return null;
  return MUSIC_LIBRARY.find((song) => song.id === id) ?? null;
}

export async function resolveSongSourceUri(song: LibrarySong): Promise<string | null> {
  const asset = Asset.fromModule(song.source);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri ?? null;
}
