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
const COVER_2001_AMBA = require("../../assets/song-2001-amba-cover.jpg");
const COVER_DOLOZOE = require("../../assets/song-dolozoe-cover.png");
const COVER_RRO_DA_RONIN = require("../../assets/song-rro-da-ronin-cover.png");
const COVER_SKYAIR = require("../../assets/song-skyair-cover.jpg");

const SONG_IMTHEONE: LibrarySong = {
  id: "imtheone",
  title: "I'm The One (feat.)",
  artist: "Amba",
  cover: COVER_AMBA,
  source: require("../../assets/song-imtheone.m4a"),
  durationMs: 0,
};

const SONG_MESIENTO_BIEN: LibrarySong = {
  id: "amba-mesientobien",
  title: "Me Siento Bien",
  artist: "Amba",
  cover: COVER_AMBA,
  source: require("../../assets/song-amba-mesientobien.m4a"),
  durationMs: 0,
};

const SONG_MONSTRUOS_EN_MI_CABEZA: LibrarySong = {
  id: "amba-monstruosenmicabeza",
  title: "Monstruos En Mi Cabeza",
  artist: "Amba",
  cover: COVER_AMBA,
  source: require("../../assets/song-amba-monstruosenmicabeza.m4a"),
  durationMs: 0,
};

const SONG_2001_AMBA_COMODOMINO: LibrarySong = {
  id: "2001-amba-comodomino",
  title: "comodominó",
  artist: "2001 amba",
  cover: COVER_2001_AMBA,
  source: require("../../assets/song-2001-amba-comodomino.m4a"),
  durationMs: 0,
};

const SONG_2001_AMBA_DIMEBB: LibrarySong = {
  id: "2001-amba-dimebb",
  title: "dimebb",
  artist: "2001 amba",
  cover: COVER_2001_AMBA,
  source: require("../../assets/song-2001-amba-dimebb.m4a"),
  durationMs: 0,
};

const SONG_2001_AMBA_LACORRIENTE: LibrarySong = {
  id: "2001-amba-lacorriente",
  title: "lacorriente",
  artist: "2001 amba",
  cover: COVER_2001_AMBA,
  source: require("../../assets/song-2001-amba-lacorriente.m4a"),
  durationMs: 0,
};

const SONG_DOLOZOE_360: LibrarySong = {
  id: "dolozoe-360",
  title: "360",
  artist: "dolozoe",
  cover: COVER_DOLOZOE,
  source: require("../../assets/song-dolozoe-360.m4a"),
  durationMs: 0,
};

const SONG_DOLOZOE_RANK: LibrarySong = {
  id: "dolozoe-rank",
  title: "Rank",
  artist: "dolozoe",
  cover: COVER_DOLOZOE,
  source: require("../../assets/song-dolozoe-rank.m4a"),
  durationMs: 0,
};

const SONG_RRO_DA_RONIN_1234: LibrarySong = {
  id: "rro-da-ronin-1234",
  title: "1234",
  artist: "rro da ronin",
  cover: COVER_RRO_DA_RONIN,
  source: require("../../assets/song-rro-da-ronin-1234.mp3"),
  durationMs: 0,
};

const SONG_RRO_DA_RONIN_HOPES: LibrarySong = {
  id: "rro-da-ronin-hopes",
  title: "Hopes",
  artist: "rro da ronin",
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
