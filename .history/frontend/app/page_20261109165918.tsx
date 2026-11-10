import SmoothScroll from "@/components/SmoothScroll";
import Hero from "@/components/Hero";
import ScrollStory from "@/components/ScrollStory";

export default function Home() {
  return (
    <SmoothScroll>
      <main>
        <Hero />
        <ScrollStory />
      </main>
    </SmoothScroll>
  );
}