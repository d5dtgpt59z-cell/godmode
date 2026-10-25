"use client";

const lessons = [
  { title: "Welcome to your tiny world.", text: "Bellwether has 24 residents with jobs, needs, memories and relationships. Watch them prepare a shared supper—or change a condition and see how they adapt.", hint: "This preview uses a clearly labeled rule policy. Live Meta decisions await verified access." },
  { title: "Everyone has something to do.", text: "Choose someone in the Residents list or click their sprite. Their notebook shows what they’re doing, what they want, and the information they actually know.", hint: "Follow a resident to keep the camera on them. Other people can know different things." },
  { title: "Change one little thing.", text: "Weather adds water but floods the ford. Supplies delivers four loaves. A note gives one resident a claim they can read, doubt, investigate or repeat.", hint: "Interventions pause the fast-forward view so you have time to choose. They never dictate a resident’s response." },
  { title: "A rumor is not a fact.", text: "The belief lens shows who accepts, doubts or rejects a claim. Follow its actual message trail, then inspect a resident’s memories and stated reason.", hint: "Opening your notebook does not magically share its contents with the residents." },
  { title: "Try another afternoon.", text: "History lets you revisit a recorded moment and branch from it. The original stays safe. Compare the same time in both versions and see what changed.", hint: "Exact replay uses saved decisions. A new branch gets a new future." },
  { title: "Tomorrow is part of the world.", text: "The saved town keeps its people, memories and history. At night residents go home and rest; dawn brings a new meal period and finite renewed supplies.", hint: "The saved-world panel shows its real clock, pause control and last server update. Background operation is active only after its updater is configured." },
];

export default function WorldGuide({ step, onStep, onClose }: { step: number; onStep: (step: number) => void; onClose: (completed?: boolean) => void }) {
  const lesson = lessons[step];
  return <section className={`world-guide guide-step-${step}`} role="dialog" aria-label="GODMODE walkthrough" aria-modal="false">
    <div className="guide-topline"><span>✿ A little tour</span><button onClick={() => onClose(false)} aria-label="Skip tutorial">Skip</button></div>
    <h2>{lesson.title}</h2><p>{lesson.text}</p><aside>{lesson.hint}</aside>
    <div className="guide-bottom"><div className="guide-dots" aria-label={`Step ${step + 1} of ${lessons.length}`}>{lessons.map((_, n) => <button key={n} aria-label={`Tutorial step ${n + 1}`} className={n === step ? "current" : ""} onClick={() => onStep(n)}/>)}</div>
      <div>{step > 0 && <button className="guide-back" onClick={() => onStep(step - 1)}>Back</button>}<button className="guide-next" onClick={() => step === lessons.length - 1 ? onClose(true) : onStep(step + 1)}>{step === lessons.length - 1 ? "Let’s explore" : "Next"}<span>→</span></button></div>
    </div>
  </section>;
}
