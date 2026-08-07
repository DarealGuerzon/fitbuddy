self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "FitBuddy", {
      body: data.body || "",
      icon: "/icon.png",
    })
  );
});
