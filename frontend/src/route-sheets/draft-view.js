export function createDraftView(document) {
  const find = (selector) => document.querySelector(selector);
  const form = find("#draft-form");
  const select = find("#draft-group");
  let previousMode;
  return {
    reset() {
      for (const name of ["busGroupId", "routeDate", "notes"])
        form.elements[name].value = "";
    },
    render({ mode, message, groups, locked, created }) {
      const selected = select.value;
      select.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Selecciona un grupo";
      select.append(placeholder);
      for (const group of groups) {
        const option = document.createElement("option");
        option.value = group.id;
        option.textContent = group.name;
        select.append(option);
      }
      select.value = selected;
      find("#draft-fields").disabled = locked;
      find("#draft-status").textContent = message;
      find("#draft-panel").dataset.mode = mode;
      find("#draft-panel").setAttribute("aria-busy", String(mode === "saving"));
      find("#another-draft").hidden = mode !== "success";
      find("#another-draft").disabled = locked && mode !== "success";
      find("#draft-result").hidden = !created;
      for (const [id, value] of [
        ["draft-id", created?.id || ""],
        [
          "draft-group-name",
          groups.find((group) => group.id === created?.busGroupId)?.name || "",
        ],
        [
          "draft-date",
          created?.routeDate?.split("-").reverse().join("/") || "",
        ],
        ["draft-state", created ? "Borrador" : ""],
        ["draft-notes", created?.notes || "Sin notas"],
      ])
        find(`#${id}`).textContent = value;
      if (
        previousMode !== mode &&
        ["success", "invalid", "rejected", "uncertain", "check-error"].includes(
          mode,
        )
      )
        find("#draft-status").focus();
      previousMode = mode;
    },
  };
}
