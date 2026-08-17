import { EditorialHero } from "./components/editorial-hero";
import { StaffPick } from "./components/staff-pick";
import { TrendingRail } from "./components/trending-rail";
import { HomePosterMarquee } from "./components/poster-marquee";
import { SiteFooter } from "../../shared/components/site-footer";
import type { AnimeMedia } from "../../shared/api/anime";

export function HomePage({
  onOpen,
  onOpenAnime,
}: {
  onOpen: () => void;
  onOpenAnime?: (anime: AnimeMedia) => void;
}) {
  return (
    <>
      <EditorialHero
        onOpen={() => {
          onOpen();
        }}
      />
      <HomePosterMarquee
        label="Everything. One Place."
        sublabel="Movies · Anime · Drama · Comics"
      />
      <TrendingRail
        onOpen={(anime) => {
          if (onOpenAnime) {
            onOpenAnime(anime);
          } else {
            onOpen();
          }
        }}
      />
      <StaffPick onOpen={onOpen} />
      <SiteFooter />
    </>
  );
}
