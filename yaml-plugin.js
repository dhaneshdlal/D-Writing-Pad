import { parseDocument, stringify } from "yaml";

window.NotepadPlugins.register({
  id: "yaml-formatter",
  name: "Format YAML",
  format(content) {
    if (!content.trim()) return "";

    const document = parseDocument(content, { uniqueKeys: true });
    if (document.errors.length > 0) {
      throw new Error(document.errors[0].message);
    }

    return stringify(document.toJS(), { indent: 2, lineWidth: 0 });
  },
});
