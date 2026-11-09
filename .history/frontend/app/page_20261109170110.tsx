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
export default function Dashboard() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="font-headline font-bold text-4xl text-primary">Dashboard coming next</h1>
    </main>
  );
}