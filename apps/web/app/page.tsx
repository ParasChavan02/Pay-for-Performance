import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import ScrollStory from "@/components/ScrollStory";
import Features from "@/components/Features";
import Pipeline from "@/components/Pipeline";
import Finale from "@/components/Finale";

export default function Home() {
  return (
    <main>
      <Hero />
      <Problem />
      <section id="story">
        <ScrollStory />
      </section>
      <Features />
      <Pipeline />
      <Finale />
    </main>
  );
}