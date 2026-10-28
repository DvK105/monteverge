import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <div className="landing__frame">
        <div className="landing__hero">
          <h1 className="landing__title"><span className="landing__name">Monteverge</span><span className="landing__period">.</span></h1>
          <div className="landing__cta">
            <Link className="landing__button" href="/market">
              Get started <span aria-hidden="true">&#8599;</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
