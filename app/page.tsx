import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import About from "@/components/About";
import Stack from "@/components/Stack";
import Experience from "@/components/Experience";
import WorkSection from "@/components/WorkSection";
import GithubHeatmap from "@/components/GithubHeatmap";
import Contact from "@/components/Contact";
import Boot from "@/components/Boot";

// The middle column's content. The side panels (identity on the left, the
// project loop on the right) come from the layout, so every route shares them
// (see HomeShell). Narrow screens drop the panels and stack these sections in
// one column, ordered by CSS.
export default function Home() {
  return (
    <>
      <Boot />
      <Hero />
      <Marquee />
      <GithubHeatmap />
      <About />
      <Stack />
      <Experience />
      <WorkSection />
      <Contact />
    </>
  );
}
