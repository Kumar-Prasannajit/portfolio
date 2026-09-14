import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import About from "@/components/About";
import Stack from "@/components/Stack";
import Experience from "@/components/Experience";
import Projects from "@/components/Projects";
import GithubHeatmap from "@/components/GithubHeatmap";
import Contact from "@/components/Contact";

export default function Home() {
  return (
    <main>
      <Hero />
      <Marquee />
      <About />
      <Stack />
      <Experience />
      <Projects />
      <GithubHeatmap />
      <Contact />
    </main>
  );
}
