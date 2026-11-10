import { CuevasMission } from "../api/cuevas-missions";
import { MissionShare } from "../types/feed";

export function toMissionShare(mission: CuevasMission): MissionShare {
  return {
    id: mission.id, title: mission.title, description: mission.description,
    points: mission.points, durationHours: mission.durationHours,
    location: mission.location, eventDate: mission.eventDate, eventDateISO: mission.eventDateISO,
    type: mission.type, difficulty: mission.difficulty, peopleNeeded: mission.peopleNeeded,
    gearProvided: mission.gearProvided, materialsNote: mission.materialsNote,
    eventUrl: mission.eventUrl, businessName: mission.businessName,
    businessHandle: mission.businessHandle, businessVerified: mission.businessVerified,
    goingCount: mission.goingCount, status: mission.status,
  };
}
