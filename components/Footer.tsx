export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer>
      <div className="wrap foot-inner">
        <span>
          © {year} Kumar Prasannajit Sahu — built with IBM Plex &amp; clean
          commits.
        </span>
        <a href="#top">back to top ↑</a>
      </div>
    </footer>
  );
}
