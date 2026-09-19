import type { Metadata } from "next";
import { PLACES } from "@/lib/data";
import TermWindow from "@/components/TermWindow";

export const metadata: Metadata = {
  title: "Places | Kumar Prasannajit Sahu",
  description: "Places I wanna go. Bucket list, funding TBD.",
};

export default function PlacesPage() {
  return (
    <main>
      <section className="section band">
        <div className="wrap">
          <div className="eyebrow">
            <span className="idx">—</span> Places
          </div>
          <h1 className="h2">Places I wanna go</h1>
          <p className="page-intro">
            The bucket list. Funding: pending. Leave: also pending.
          </p>

          {PLACES.length === 0 ? (
            <TermWindow
              path="~/kumar/places.txt"
              lines={[
                { text: "$ cat places.txt", tone: "prompt" },
                { text: "bro's broke, bucket list unfunded." },
                { text: "(list's still loading — ask me in person.)" },
              ]}
            />
          ) : (
            <div className="places-grid">
              {PLACES.map((place, i) => (
                <div className="place-card" key={place.name}>
                  <div className="place-idx mono">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3>{place.name}</h3>
                  <p>{place.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
