import { useEffect, useState } from "react";
import { createDish, createMenu, getDishes, getMenus, isMenuMockMode } from "../api/menus-api.ts";
import DishForm from "../components/DishForm.tsx";
import MenuEditor from "../components/MenuEditor.tsx";
import type { CreateDishRequest, Dish, Menu } from "../types/menu.ts";
import PageHeader from "../../shared/components/PageHeader.tsx";
import SectionTitle from "../../shared/components/SectionTitle.tsx";
import Icon from "../../shared/components/Icon.tsx";
import { primaryButton, sectionCard as card } from "../../shared/styles.ts";

export default function ManageMenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedId, setSelectedId] = useState<number | null | undefined>(undefined);
  const [newMenuRevision, setNewMenuRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showDishForm, setShowDishForm] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([getMenus(), getDishes()])
      .then(([loadedMenus, loadedDishes]) => {
        if (!active) return;
        setMenus(loadedMenus);
        setDishes(loadedDishes);
        setSelectedId((previous) => previous === undefined ? (loadedMenus[0]?.id ?? null) : previous);
        setLoadError(null);
      })
      .catch((err: Error) => { if (active) setLoadError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const selectedMenu = menus.find((menu) => menu.id === selectedId) ?? null;
  const templates = menus.filter((menu) => menu.type === "TEMPLATE");
  const custom = menus.filter((menu) => menu.type === "MODIFIED");

  function pickMenu(id: number | null) {
    setSelectedId(id);
    setNotice(null);
    setShowDishForm(false);
    if (id === null) setNewMenuRevision((value) => value + 1);
  }

  async function saveMenu(name: string, dishIds: number[]) {
    const { id } = await createMenu({ name, type: "MODIFIED", dishes: dishIds });
    const updated = await getMenus();
    setMenus(updated);
    setSelectedId(id);
    setNotice(`Custom menu "${name}" created.`);
    setShowDishForm(false);
  }

  async function saveDish(input: CreateDishRequest): Promise<Dish> {
    const dish = await createDish(input);
    setDishes((current) => [...current, dish]);
    setShowDishForm(false);
    setNotice(`Dish "${dish.name}" added. You can now select it in a course.`);
    return dish;
  }

  return (
    <div className="relative left-1/2 w-[min(80rem,calc(100vw-2rem))] -translate-x-1/2 space-y-6">
      <PageHeader
        icon="book"
        eyebrow="Staff · Kitchen"
        title="Manage menus"
        subtitle="Browse default menus and create custom versions using available dishes."
      />
      {isMenuMockMode && (
        <p className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status">
          <Icon name="info" className="w-5 h-5" />
          Demo mode: menu and dish changes are kept in memory and will reset when the page reloads.
        </p>
      )}
      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 animate-pop-in">
          <Icon name="check" className="w-5 h-5" />
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status" className={`${card} flex items-center gap-3 text-stone-500`}>
          <span className="w-5 h-5 rounded-full border-2 border-green-600 border-t-transparent animate-spin" aria-hidden="true" />
          Loading menus…
        </p>
      ) : loadError ? (
        <div role="alert" className={`${card} space-y-3`}>
          <p className="flex items-center gap-2 text-red-700">
            <Icon name="warning" className="w-5 h-5" />
            Could not load menus: {loadError}
          </p>
          <button type="button" onClick={() => { setLoading(true); setReload((value) => value + 1); }} className={primaryButton}>
            <Icon name="repeat" className="w-5 h-5" />
            Retry
          </button>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)]">
          <aside className={`${card} space-y-6 lg:sticky lg:top-20`} aria-label="Menu selection">
            <section aria-label="Default menus" className="space-y-4">
              <SectionTitle icon="book" title="Default menus" hint="Templates from the kitchen" />
              <div className="space-y-2">
                {templates.length === 0 && <p className="rounded-xl border-2 border-dashed border-stone-300 px-4 py-4 text-center text-sm text-stone-500">No default menus yet</p>}
                {templates.map((menu) => (
                  <button
                    key={menu.id}
                    type="button"
                    aria-pressed={selectedId === menu.id}
                    onClick={() => pickMenu(menu.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base font-medium transition-all cursor-pointer ${selectedId === menu.id ? "border-green-600 bg-green-50 text-green-900 shadow-sm" : "border-stone-200 bg-white text-stone-800 hover:border-green-500 hover:shadow-sm"}`}
                  >
                    <Icon name="book" className={`w-5 h-5 ${selectedId === menu.id ? "text-green-700" : "text-stone-400"}`} />
                    <span className="min-w-0 flex-1 truncate">{menu.name}</span>
                    <Icon name="chevronRight" className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${selectedId === menu.id ? "text-green-700" : "text-stone-300"}`} />
                  </button>
                ))}
              </div>
            </section>
            <div className="border-t border-stone-200" />
            <section aria-label="Custom menus" className="space-y-4">
              <SectionTitle icon="pencil" title="Custom menus" hint="Your own versions" />
              <div className="space-y-2">
                {custom.length === 0 && <p className="rounded-xl border-2 border-dashed border-stone-300 px-4 py-4 text-center text-sm text-stone-500">No custom menus yet</p>}
                {custom.map((menu) => (
                  <button
                    key={menu.id}
                    type="button"
                    aria-pressed={selectedId === menu.id}
                    onClick={() => pickMenu(menu.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base font-medium transition-all cursor-pointer ${selectedId === menu.id ? "border-green-600 bg-green-50 text-green-900 shadow-sm" : "border-stone-200 bg-white text-stone-800 hover:border-green-500 hover:shadow-sm"}`}
                  >
                    <Icon name="book" className={`w-5 h-5 ${selectedId === menu.id ? "text-green-700" : "text-stone-400"}`} />
                    <span className="min-w-0 flex-1 truncate">{menu.name}</span>
                    <Icon name="chevronRight" className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${selectedId === menu.id ? "text-green-700" : "text-stone-300"}`} />
                  </button>
                ))}
              </div>
            </section>
            <button type="button" onClick={() => pickMenu(null)} className={`${primaryButton} w-full`}>
              + New menu
            </button>
          </aside>
          <div className="space-y-6">
            <section className={card} style={{ animationDelay: "80ms" }} aria-label="Menu editor">
              <MenuEditor
                key={selectedMenu ? `menu-${selectedMenu.id}` : `new-${newMenuRevision}`}
                menu={selectedMenu}
                dishes={dishes}
                onSave={saveMenu}
                onNewDish={() => { setShowDishForm(true); setNotice(null); }}
              />
            </section>
            {showDishForm && (
              <DishForm available={isMenuMockMode} onCreate={saveDish} onClose={() => setShowDishForm(false)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
