import { Asset } from "expo-asset";

export interface LibrarySong {
  id: string;
  title: string;
  artist: string;
  cover: number;
  source: number;
  durationMs: number;
}

const SONG_IMTHEONE: LibrarySong = {
  id: "imtheone",
  title: "I'm The One (feat.)",
  artist: "Amba",
  cover: require("../../assets/song-imtheone-cover.png"),
  source: require("../../assets/song-imtheone.m4a"),
  durationMs: 0,
};

const SONG_MESIENTO_BIEN: LibrarySong = {
  id: "amba-mesientobien",
  title: "Me Siento Bien",
  artist: "Amba",
  cover: require("../../assets/song-imtheone-cover.png"),
  source: require("../../assets/song-amba-mesientobien.m4a"),
  durationMs: 0,
};

const SONG_MONSTRUOS_EN_MI_CABEZA: LibrarySong = {
  id: "amba-monstruosenmicabeza",
  title: "Monstruos En Mi Cabeza",
  artist: "Amba",
  cover: require("../../assets/song-imtheone-cover.png"),
  source: require("../../assets/song-amba-monstruosenmicabeza.m4a"),
  durationMs: 0,
};

export const MUSIC_LIBRARY: LibrarySong[] = [
  SONG_IMTHEONE,
  SONG_MESIENTO_BIEN,
  SONG_MONSTRUOS_EN_MI_CABEZA,
];

export function getSongById(id?: string | null): LibrarySong | null {
  if (!id) return null;
  return MUSIC_LIBRARY.find((s) => s.id === id) || null;
}

export async function resolveSongSourceUri(song: LibrarySong): Promise<string | null> {
  try {
    const asset = Asset.fromModule(song.source);
    if (!asset.localUri) {
      await asset.downloadAsync();
    }
    return asset.localUri || asset.uri || null;
  } catch {
    return null;
  }
}
