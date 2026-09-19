import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import About from "@/components/About";
import Stack from "@/components/Stack";
import Experience from "@/components/Experience";
import Projects from "@/components/Projects";
import GithubHeatmap from "@/components/GithubHeatmap";
import Contact from "@/components/Contact";
import HomeShell from "@/components/HomeShell";

// Wide screens: the middle column is the page, the left panel holds the
// profile sections and the right panel loops the projects (see HomeShell).
// Narrow screens stack the same sections in one column, ordered by CSS.
export default function Home() {
  return (
    <HomeShell
      left={
        <>
          <About />
          <Stack />
          <Experience />
        </>
      }
      middle={
        <>
          <Hero />
          <Marquee />
          <GithubHeatmap />
          <Contact />
        </>
      }
      right={<Projects />}
    />
  );
}
