import { useState } from "react";
import { Plus, Trash2, Camera, Pencil, Check, X } from "lucide-react";
import { useWorkspace, workspace, type Scene } from "@/state/workspace";
import { toast } from "sonner";

/**
 * Scenes panel — RPG-style one-tap recall of music + master state.
 * Capture the currently playing music as a named scene, then later tap
 * the tile to crossfade back into that arrangement (Tavern, Combat, etc.).
 */
export function ScenesPanel() {
  const scenes = useWorkspace((s) => s.scenes);
  const activeId = useWorkspace((s) => s.activeSceneId);
  const [newName, setNewName] = useState("");

  const capture = () => {
    const name = newName.trim() || `Scene ${scenes.length + 1}`;
    workspace.captureScene(name);
    setNewName("");
    toast.success(`Captured "${name}"`);
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm">
      <header className="flex items-center gap-1">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && capture()}
          placeholder="Scene name (e.g. Tavern)"
          className="readout flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
        />
        <button
          onClick={capture}
          className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-[10px] uppercase tracking-wider text-primary-foreground hover:brightness-110"
          title="Capture currently-playing music as a scene"
        >
          <Camera className="h-3 w-3" /> Capture
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-border">
        {scenes.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Play some music, then capture a scene. Tap a saved scene later to
            crossfade back into it.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
          {scenes.map((sc) => (
            <SceneTile key={sc.id} scene={sc} active={sc.id === activeId} />
          ))}
          <button
            onClick={capture}
            className="flex h-20 items-center justify-center rounded border border-dashed border-border text-xs uppercase text-muted-foreground hover:bg-secondary"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SceneTile({ scene, active }: { scene: Scene; active: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(scene.name);

  const commit = () => {
    workspace.renameScene(scene.id, name.trim() || scene.name);
    setEditing(false);
  };

  return (
    <div
      className={`relative flex h-20 cursor-pointer flex-col items-center justify-center rounded border px-2 text-center transition active:scale-[0.97] ${
        active
          ? "border-primary bg-primary/20"
          : "border-border bg-secondary hover:brightness-110"
      }`}
      onClick={() => !editing && workspace.recallScene(scene.id)}
    >
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="readout w-full rounded border border-border bg-background px-1 text-xs"
        />
      ) : (
        <span className="line-clamp-2 text-xs font-medium">{scene.name}</span>
      )}
      <span className="mt-0.5 text-[9px] uppercase tracking-wider opacity-60">
        {scene.music.length} track{scene.music.length === 1 ? "" : "s"}
      </span>
      <div className="absolute right-1 top-1 flex gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setName(scene.name);
            setEditing(!editing);
          }}
          className="rounded bg-background/80 p-0.5 hover:bg-background"
          aria-label="Rename"
        >
          {editing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            workspace.removeScene(scene.id);
          }}
          className="rounded bg-background/80 p-0.5 text-destructive hover:bg-background"
          aria-label="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

