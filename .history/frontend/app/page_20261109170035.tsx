import SmoothScroll from "@/components/SmoothScroll";
import Hero from "@/components/Hero";
import ScrollStory from "@/components/ScrollStory";
import Finale from "@/components/Finale";

export default function Home() {
  return (
    <SmoothScroll>
      <main>
        <Hero />
        <ScrollStory />
        <Finale />
      </main>
    </SmoothScroll>
  );
}