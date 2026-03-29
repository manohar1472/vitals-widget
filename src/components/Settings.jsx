export default function Settings({ alwaysOnTop, setAlwaysOnTop }) {
  return (
    <div style={{ padding: "8px", fontSize: "14px" }}>
      <label>
        <input
          type="checkbox"
          checked={alwaysOnTop}
          onChange={(e) => setAlwaysOnTop(e.target.checked)}
        />
        {" "}Always on top
      </label>
    </div>
  );
}
