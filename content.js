chrome.storage.sync.get("list", function(data) {
  data.list.forEach(item => {
    let { keybind, site, script } = item;

    if (
      site !== "" &&
      !location.host.toLowerCase().includes(site.toLowerCase())
    ) {
      return;
    }

    if (keybind.keyCode === -1) {
      eval(script);
    } else {
      document.addEventListener("keydown", event => {
        if (event.keyCode === keybind.keyCode) {
          eval(script);
        }
      });
    }
  });
});
