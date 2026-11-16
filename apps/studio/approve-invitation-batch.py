#!/usr/bin/env python3
"""Test-source audit gate in disposable DB, snapshot, then import approved draft batch."""
import datetime,gzip,hashlib,json,os,sqlite3,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
STUDIO=ROOT/"apps/studio"
LIVE=ROOT/"channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite"
BACKUPS=LIVE.parent/"backups"
SQL="""SELECT s.key,r.title,r.body,r.blocks_json,r.source_video_ids_json,
r.entity_references_json,r.state FROM narrative_sections s JOIN narrative_section_revisions r
 ON r.id=s.current_revision_id ORDER BY s.key"""
def fingerprint(conn):
    rows=conn.execute(SQL).fetchall()
    return {row[0]:hashlib.sha256(json.dumps(row,ensure_ascii=False).encode()).hexdigest() for row in rows}
def run_node(script,*args):
    completed=subprocess.run(["node",str(STUDIO/script),*map(str,args)],cwd=ROOT,
        stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
    print(completed.stdout[-15000:],flush=True)
    if completed.returncode:raise RuntimeError(f"{script} failed with {completed.returncode}")
def main():
    start,end=map(int,sys.argv[1:3])
    if not (11<=start<=end<=68 and end-start<=11):raise ValueError("Bounded 12-number batch required")
    BACKUPS.mkdir(exist_ok=True)
    with sqlite3.connect(f"file:{LIVE}?mode=ro",uri=True) as live:
        if live.execute("PRAGMA quick_check").fetchone()[0]!="ok":raise RuntimeError("Live corruption before import")
        before=fingerprint(live)
        pending=live.execute("SELECT count(*) FROM narrative_sections").fetchone()[0]
    with tempfile.TemporaryDirectory(prefix=f"bs-inv-{start}-{end}-") as directory:
        temp=Path(directory)/"import.sqlite"
        # Import tool requires --db paths under /tmp; TemporaryDirectory defaults there.
        with sqlite3.connect(str(LIVE)) as src,sqlite3.connect(str(temp)) as dst:src.backup(dst)
        run_node("mark-reviewed-invitations.cjs","--db",temp,"--start",start,"--end",end)
        run_node("import-reviewed-invitations.cjs","--db",temp,"--start",start,"--end",end,"--apply")
        with sqlite3.connect(temp) as after:
            tempBefore=fingerprint(after)
            if any(tempBefore.get(k)!=v for k,v in before.items()):
                raise RuntimeError("Test copy mutated a previously approved chapter")
            if after.execute("PRAGMA quick_check").fetchone()[0]!="ok":raise RuntimeError("Test DB integrity error")
        stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        archive=BACKUPS/f"before-invitations-{start:02d}-{end:02d}-{stamp}.sqlite.gz"
        # Fully consistent SQLite backup, then compressed before mutating the live DB.
        backup=Path(directory)/"backup.sqlite"
        with sqlite3.connect(str(LIVE)) as src,sqlite3.connect(str(backup)) as dest:src.backup(dest)
        with backup.open("rb") as infile,gzip.open(archive,"wb",compresslevel=3) as outfile:
            while chunk:=infile.read(2**20):outfile.write(chunk)
        if archive.stat().st_size<10000:raise RuntimeError("Backup archive suspiciously small")
        print("LIVE_BACKUP",archive,archive.stat().st_size,flush=True)
        run_node("mark-reviewed-invitations.cjs","--start",start,"--end",end)
        run_node("import-reviewed-invitations.cjs","--start",start,"--end",end,"--apply")
        with sqlite3.connect(f"file:{LIVE}?mode=ro",uri=True) as after:
            current=fingerprint(after)
            if any(current.get(k)!=v for k,v in before.items()):
                raise RuntimeError("Live import modified old approved chapters")
            if current!=tempBefore:
                raise RuntimeError("Test copy and live resulting canonical narratives differ")
            if after.execute("PRAGMA quick_check").fetchone()[0]!="ok":raise RuntimeError("Live integrity error")
            if after.execute("PRAGMA foreign_key_check").fetchall():raise RuntimeError("Foreign keys invalid")
            afterCount=after.execute("SELECT count(*) FROM narrative_sections").fetchone()[0]
            trApproved=after.execute("""SELECT count(*) FROM publication_language_variants
                WHERE kind='section' AND language='tr' AND state='approved'
                 AND id LIKE 'narrative-section-dugumlu-invitation-%'""").fetchone()[0]
            print("APPROVED_BATCH",json.dumps(dict(range=[start,end],before=pending,after=afterCount,
                delta=afterCount-pending,turkishNumbered=trApproved,integrity="ok")),flush=True)
if __name__=="__main__":main()
