// Screens for the family cloud copy: who is learning on a new device, and the grown-ups' cloud card.
import { useEffect, useState } from 'react';
import { BrandMark } from './art';
import { Btn } from './ui';
import { currentDb, db, forgetDb, learnerDbs, switchDb, type Settings } from './db';
import { cloudStatus, createAndLink, isFamily, link, listLearners, openLearner, startSomeoneNew, syncNow, useCloudStatus, useLink, type Learner } from './cloud';

/** First screen on a device with no learner yet, when a family member is signed in: carry on as someone saved, or set up someone new. */
export function WhoIsLearning({ onNew }: { onNew: () => void }) {
  const [list, setList] = useState<Learner[] | null | 'error'>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { listLearners().then(setList, () => setList('error')); }, []);
  useEffect(() => { if (Array.isArray(list) && !list.length) onNew(); }, [list, onNew]); // nobody saved yet: straight to setup

  const pick = async (l: Learner) => {
    const known = learnerDbs()[l.id];
    if (known && known !== currentDb()) return switchDb(known);
    setBusy(l.name); setErr('');
    await link(l.id, 'empty');
    const s = (await db.kv.get('settings'))?.value as Partial<Settings> | undefined;
    if (!s) { // nothing came down: undo, so this device does not overwrite the cloud copy with a fresh setup
      await db.kv.delete('cloud'); forgetDb();
      setBusy(''); setErr(`Could not get ${l.name}'s progress. Check the connection and try again.`);
    }
  };

  return <main className="center" style={{ minHeight: '90vh' }}><div className="card stack" style={{ maxWidth: 560, width: '100%' }}>
    <span className="brand"><BrandMark />Learning to Fly</span>
    <h1>Who is learning on this device?</h1>
    <p>Pick a learner to carry on where they left off. Their progress comes from your family's cloud copy.</p>
    {list === null && <p role="status">Looking for learners…</p>}
    {list === 'error' && <p role="status">The family cloud copy could not be reached. You can still set up someone new on this device.</p>}
    {Array.isArray(list) && <div className="stack">{list.map((l) =>
      <Btn key={l.id} className="primary big" isDisabled={!!busy} onPress={() => pick(l)}>{l.name}</Btn>)}</div>}
    {busy && <p role="status">Getting {busy}'s progress…</p>}
    {err && <p role="alert">{err}</p>}
    <Btn className="quiet" isDisabled={!!busy} onPress={onNew}>Someone new</Btn>
  </div></main>;
}

const time = (t?: number) => (t ? new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');

/** Who is signed in, and where this learner's progress is kept. Hidden where there is no sign-in, such as a local dev server. */
export function CloudCard({ name }: { name: string }) {
  const s = useCloudStatus();
  const lk = useLink();
  const [others, setOthers] = useState<Learner[] | null>(null);
  const [msg, setMsg] = useState('');
  if (!s.checked || s.me === undefined) return null;
  const signIn = `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(location.origin + '/')}`;
  if (!s.me || !isFamily(s.me)) return <section className="card stack">
    <h2>Sign-in and cloud copy</h2>
    <p style={{ margin: 0 }}>This device is not signed in right now. The app keeps working and saves on this device. Sign in to keep the family cloud copy up to date and to get new versions.</p>
    <div className="row"><a className="btn primary" href={signIn}>Sign in with Microsoft</a></div>
  </section>;

  const load = () => listLearners().then(setOthers, () => setMsg('The cloud copy could not be reached. Try again when this device is online.'));
  const attempt = (f: () => Promise<unknown>) => f().catch(() => setMsg('That did not work. Check the connection and try again.'));
  const line = { idle: 'Connecting…', syncing: 'Saving…', ok: `Saved at ${time(s.at)}.`, offline: 'Offline. Changes stay on this device and go up when the connection is back.',
    'signed-out': 'The sign-in has expired. Sign in again to keep the cloud copy up to date.', gone: 'This learner was removed from the cloud copy. Progress on this device is kept.' }[s.state];

  return <section className="card stack">
    <h2>Sign-in and cloud copy</h2>
    <p style={{ margin: 0 }}>Signed in as <b>{s.me.userDetails}</b>.</p>
    {lk ? <>
      <p style={{ margin: 0 }}>{name}'s progress is saved on this device and in your family's cloud copy. It opens on any device where a family member signs in.</p>
      <p role="status" className="tagline">{line}</p>
      {s.state === 'signed-out' && <a className="btn primary" href={signIn}>Sign in again</a>}
      <div className="row"><Btn className="small" onPress={() => syncNow()}>Save now</Btn><Btn className="small" onPress={load}>Switch learner</Btn></div>
      {others && <div className="row">
        {others.filter((o) => o.id !== lk.learner).map((o) => <Btn key={o.id} className="small" onPress={() => attempt(() => openLearner(o.id))}>Open {o.name}</Btn>)}
        <Btn className="small quiet" onPress={startSomeoneNew}>Someone new</Btn>
      </div>}
    </> : <>
      <p style={{ margin: 0 }}>{name}'s progress is only in this browser. Save it to the cloud copy to open it on other devices.</p>
      {s.state === 'gone' && <p role="status" className="tagline">{line}</p>}
      <div className="row"><Btn className="primary small" onPress={() => attempt(() => createAndLink(name))}>Save {name} to the cloud</Btn>
        <Btn className="small" onPress={load}>Already saved from another device?</Btn></div>
      {others && <div className="stack">
        {others.length ? others.map((o) => <Btn key={o.id} className="small" onPress={() => attempt(() => link(o.id, 'join'))}>Add this device's progress to {o.name}</Btn>)
          : <p className="tagline">Nobody is saved in the cloud copy yet.</p>}
      </div>}
    </>}
    {msg && <p role="status">{msg}</p>}
    <div className="row"><a className="btn small quiet" href="/.auth/logout?post_logout_redirect_uri=/">Sign out</a></div>
    <p className="tagline">Only Microsoft accounts invited to the family role can open the app or its cloud copy. Invite people in the Azure portal: the Static Web App, then Role management.</p>
  </section>;
}

/**
 * "Save my progress", for him. Everything is already saved on this device as he goes; this asks the browser to keep it,
 * sends it to the family copy now when this device is linked, and says plainly where it is saved.
 */
export function SaveProgress() {
  const [msg, setMsg] = useState('');
  const save = async () => {
    setMsg('Saving…');
    await navigator.storage?.persist?.().catch(() => false);
    const linked = !!(await db.kv.get('cloud')) && isFamily(cloudStatus().me);
    if (linked) await syncNow();
    const state = linked ? cloudStatus().state : 'local';
    const at = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    setMsg(state === 'ok' ? `Saved at ${at}, on this device and in your family's copy.`
      : state === 'local' ? `Saved at ${at} on this device.`
      : state === 'signed-out' ? `Saved at ${at} on this device. A grown-up needs to sign in again to send it to your family's copy.`
      : `Saved at ${at} on this device. It goes to your family's copy when you are back online.`);
  };
  return <div className="stack" style={{ gap: '0.3rem' }}>
    <Btn className="big" onPress={save}><span className="ico" aria-hidden>💾</span>Save my progress</Btn>
    <p role="status" className="tagline" style={{ margin: 0 }}>{msg}</p>
  </div>;
}
