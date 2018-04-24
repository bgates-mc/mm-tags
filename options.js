Vue.use(VueMaterial.default);

let scripts = new Vue({
  el: "#scripts",
  data: {
    defaultItem: {
      keybind: { keyCode: -1, keyName: "On Page Load" },
      site: "",
      script: "console.log('Hello World');"
    },
    list: [],
    loading: true
  },
  methods: {
    handleKeybind: function(event, index) {
      Vue.set(this.list, index, {
        ...this.list[index],
        keybind: {
          keyCode: event.keyCode,
          keyName: event.code
        }
      });
    },
    handleDelete: function(index) {
      this.list.splice(index, 1);
    },
    handleReset: function(index) {
      Vue.set(this.list, index, {
        ...this.list[index],
        keybind: {
          keyCode: -1,
          keyName: "On Page Load"
        }
      });
    },
    handleSave: function() {
      chrome.storage.sync.set({ list: this.list });
    },
    handleNew: function() {
      this.list.push({ ...this.defaultItem });
    }
  }
});

chrome.storage.sync.get("list", data => {
  scripts.list = data.list;
  scripts.loading = false;
});
