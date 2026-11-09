import Hero from "@/components/Hero";
import ScrollStory from "@/components/ScrollStory";
import Features from "@/components/Features";
import Pipeline from "@/components/Pipeline";
import Finale from "@/components/Finale";

export default function Home() {
  return (
    <main>
      <Hero />
      <section id="story" className="scroll-mt-0">
        <ScrollStory />
      </section>
      <Features />
      <Pipeline />
      <Finale />
    </main>
  );
}