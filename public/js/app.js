/* ========================================
   CLERK + APPLICATION
======================================== */

let currentPage = "home";
let collections = [];
let currentLinksPage = 1;

let homeSearchTimer;
let linksSearchTimer;


/* ========================================
   DOM HELPERS
======================================== */

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  document.querySelectorAll(selector);


/* ========================================
   TOAST
======================================== */

function showToast(message) {

  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}


/* ========================================
   CLERK INITIALIZATION
======================================== */

async function initializeClerk() {

  try {

    await Clerk.load();

    /*
      User is not signed in
    */

    if (!Clerk.user) {

      $("#auth-screen").style.display =
        "flex";

      $("#app").style.display =
        "none";

      Clerk.mountSignIn(
        document.getElementById(
          "clerk-sign-in"
        )
      );

      return;
    }


    /*
      User is signed in
    */

    $("#auth-screen").style.display =
      "none";

    $("#app").style.display =
      "block";


    loadProfile();

    await initializeApp();


  } catch (error) {

    console.error(
      "Clerk initialization failed:",
      error
    );

    showToast(
      "Authentication failed. Please refresh."
    );
  }
}


/* ========================================
   PROFILE
======================================== */

function loadProfile() {

  if (!Clerk.user) return;

  const user = Clerk.user;

  const name =
    [
      user.firstName,
      user.lastName
    ]
      .filter(Boolean)
      .join(" ") ||
    "User";


  const email =
    user.primaryEmailAddress
      ?.emailAddress ||
    "";


  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();


  $("#profile-name").textContent =
    name;

  $("#profile-email").textContent =
    email;

  $("#profile-avatar").textContent =
    initials || "U";
}


/* ========================================
   SIGN OUT
======================================== */

$("#sign-out-button")?.addEventListener(
  "click",
  async () => {

    try {

      await Clerk.signOut();

      window.location.reload();

    } catch (error) {

      console.error(
        "Sign out failed:",
        error
      );

      showToast(
        "Failed to sign out."
      );
    }
  }
);


/* ========================================
   API HELPER
======================================== */

async function apiRequest(
  url,
  options = {}
) {

  try {

    if (!Clerk.session) {

      throw new Error(
        "User not authenticated"
      );
    }


    /*
      Get a fresh Clerk session token.
    */

    const token =
      await Clerk.session.getToken();


    const response =
      await fetch(url, {

        ...options,

        headers: {

          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${token}`,

          ...(options.headers || {})
        }

      });


    /*
      Handle empty responses safely.
    */

    const text =
      await response.text();

    let data = {};

    if (text) {

      try {

        data = JSON.parse(text);

      } catch {

        data = {
          message: text
        };
      }
    }


    if (!response.ok) {

      throw new Error(
        data.error ||
        data.message ||
        `Request failed (${response.status})`
      );
    }


    return data;


  } catch (error) {

    console.error(
      "API request failed:",
      error
    );

    showToast(error.message);

    throw error;
  }
}


/* ========================================
   PAGE NAVIGATION
======================================== */

function showPage(page) {

  currentPage = page;


  /*
    Hide pages
  */

  $$(".page").forEach((section) => {

    section.classList.remove(
      "active"
    );

  });


  /*
    Show selected page
  */

  const targetPage =
    $(`#${page}-page`);

  if (targetPage) {

    targetPage.classList.add(
      "active"
    );
  }


  /*
    Update navigation
  */

  $$(".nav-item").forEach((item) => {

    item.classList.toggle(
      "active",
      item.dataset.page === page
    );

  });


  /*
    Load page data
  */

  if (page === "home") {

    loadHome();
  }

  if (page === "links") {

    loadLinks();
  }

  if (page === "organize") {

    loadCollections();
  }
}


/* ========================================
   NAVIGATION EVENTS
======================================== */

$$("[data-page]").forEach((item) => {

  item.addEventListener(
    "click",
    () => {

      const page =
        item.dataset.page;

      if (page) {

        showPage(page);
      }
    }
  );

});


/* ========================================
   LINK MODAL
======================================== */

function openLinkModal() {

  const modal =
    $("#link-modal");

  if (!modal) return;

  modal.classList.remove(
    "hidden"
  );

  modal.setAttribute(
    "aria-hidden",
    "false"
  );


  loadCollectionOptions();


  setTimeout(() => {

    $("#link-url")?.focus();

  }, 50);
}


function closeLinkModal() {

  const modal =
    $("#link-modal");

  if (!modal) return;

  modal.classList.add(
    "hidden"
  );

  modal.setAttribute(
    "aria-hidden",
    "true"
  );


  $("#add-link-form")?.reset();
}


$("#add-link-button")?.addEventListener(
  "click",
  openLinkModal
);


$("#close-link-modal")?.addEventListener(
  "click",
  closeLinkModal
);


$("#cancel-link")?.addEventListener(
  "click",
  closeLinkModal
);


$("#link-modal .modal-overlay")
  ?.addEventListener(
    "click",
    closeLinkModal
  );


/* ========================================
   COLLECTION MODAL
======================================== */

function openCollectionModal() {

  const modal =
    $("#collection-modal");

  if (!modal) return;

  modal.classList.remove(
    "hidden"
  );

  modal.setAttribute(
    "aria-hidden",
    "false"
  );


  setTimeout(() => {

    $("#collection-name")?.focus();

  }, 50);
}


function closeCollectionModal() {

  const modal =
    $("#collection-modal");

  if (!modal) return;

  modal.classList.add(
    "hidden"
  );

  modal.setAttribute(
    "aria-hidden",
    "true"
  );


  $("#collection-form")?.reset();
}


$("#add-collection-button")
  ?.addEventListener(
    "click",
    openCollectionModal
  );


$("#close-collection-modal")
  ?.addEventListener(
    "click",
    closeCollectionModal
  );


$("#cancel-collection")
  ?.addEventListener(
    "click",
    closeCollectionModal
  );


$("#collection-modal .modal-overlay")
  ?.addEventListener(
    "click",
    closeCollectionModal
  );


/* ========================================
   LOAD COLLECTIONS
======================================== */

async function loadCollections() {

  try {

    const result =
      await apiRequest(
        "/api/collections"
      );


    collections =
      Array.isArray(result)
        ? result
        : result.data || [];


    renderCollections();

    loadCollectionOptions();

    renderHomeCollections();


  } catch (error) {

    console.error(
      "Failed to load collections:",
      error
    );
  }
}


/* ========================================
   RENDER COLLECTIONS
======================================== */

function renderCollections() {

  const container =
    $("#collections-list");

  if (!container) return;


  if (!collections.length) {

    container.innerHTML = `
      <div class="link-card">
        <p class="description">
          No collections yet.
          Create your first collection.
        </p>
      </div>
    `;

    return;
  }


  container.innerHTML =
    collections
      .map((collection) => {

        return `
          <div class="collection-card">

            <div class="collection-info">

              <h3>
                ${escapeHtml(
                  collection.name
                )}
              </h3>

              <p>
                Collection
              </p>

            </div>

            <div class="collection-actions">

              <button
                class="secondary-button"
                onclick="editCollection(${collection.id})"
              >
                Rename
              </button>

              <button
                class="danger-button"
                onclick="deleteCollection(${collection.id})"
              >
                Delete
              </button>

            </div>

          </div>
        `;

      })
      .join("");
}


/* ========================================
   COLLECTION OPTIONS
======================================== */

function loadCollectionOptions() {

  const selects = [

    $("#link-collection"),

    $("#collection-filter")

  ];


  selects.forEach((select) => {

    if (!select) return;


    const currentValue =
      select.value;


    const firstOption =
      select.id ===
      "link-collection"

        ? `<option value="">
             No Collection
           </option>`

        : `<option value="">
             All Collections
           </option>`;


    select.innerHTML =
      firstOption +

      collections
        .map(
          (collection) => `
            <option value="${collection.id}">
              ${escapeHtml(
                collection.name
              )}
            </option>
          `
        )
        .join("");


    select.value =
      currentValue;
  });
}


/* ========================================
   CREATE COLLECTION
======================================== */

$("#collection-form")
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const name =
        $("#collection-name")
          .value
          .trim();


      if (!name) {

        showToast(
          "Collection name is required"
        );

        return;
      }


      try {

        await apiRequest(
          "/api/collections",
          {

            method: "POST",

            body: JSON.stringify({
              name
            })

          }
        );


        showToast(
          "Collection created"
        );


        closeCollectionModal();


        await loadCollections();


      } catch {
        // Error already handled.
      }

    }
  );


/* ========================================
   EDIT COLLECTION
======================================== */

async function editCollection(id) {

  const collection =
    collections.find(
      (item) =>
        Number(item.id) ===
        Number(id)
    );


  if (!collection) return;


  const newName =
    prompt(
      "Enter the new collection name:",
      collection.name
    );


  if (newName === null) return;


  const name =
    newName.trim();


  if (!name) {

    showToast(
      "Collection name is required"
    );

    return;
  }


  try {

    await apiRequest(
      `/api/collections/${id}`,
      {

        method: "PATCH",

        body: JSON.stringify({
          name
        })

      }
    );


    showToast(
      "Collection renamed"
    );


    await loadCollections();


    if (currentPage === "links") {

      loadLinks();
    }


  } catch {
    // Error already handled.
  }
}


/* ========================================
   DELETE COLLECTION
======================================== */

async function deleteCollection(id) {

  const collection =
    collections.find(
      (item) =>
        Number(item.id) ===
        Number(id)
    );


  if (!collection) return;


  const confirmed =
    confirm(
      `Delete "${collection.name}"?`
    );


  if (!confirmed) return;


  try {

    await apiRequest(
      `/api/collections/${id}`,
      {
        method: "DELETE"
      }
    );


    showToast(
      "Collection deleted"
    );


    await loadCollections();


    if (currentPage === "links") {

      loadLinks();
    }


  } catch {
    // Error already handled.
  }
}


/* ========================================
   ADD LINK
======================================== */

$("#add-link-form")
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const url =
        $("#link-url")
          .value
          .trim();


      const title =
        $("#link-title")
          .value
          .trim();


      const description =
        $("#link-description")
          .value
          .trim();


      const collectionId =
        $("#link-collection")
          .value;


      if (!url || !title) {

        showToast(
          "URL and title are required"
        );

        return;
      }


      const body = {

        url,

        title,

        description:
          description || null,

        collection_id:
          collectionId
            ? Number(collectionId)
            : null

      };


      try {

        await apiRequest(
          "/api/links",
          {

            method: "POST",

            body: JSON.stringify(body)

          }
        );


        showToast(
          "Link saved"
        );


        closeLinkModal();


        if (currentPage === "home") {

          loadHome();

        } else if (
          currentPage === "links"
        ) {

          currentLinksPage = 1;

          loadLinks();

        }


      } catch {
        // Error already handled.
      }

    }
  );


/* ========================================
   LOAD LINKS
======================================== */

async function loadLinks() {

  const container =
    $("#all-links");

  if (!container) return;


  container.innerHTML = `
    <div class="link-card">
      <p class="description">
        Loading links...
      </p>
    </div>
  `;


  const search =
    $("#links-search")
      ?.value
      .trim() || "";


  const collectionId =
    $("#collection-filter")
      ?.value || "";


  const favorite =
    $("#favorite-filter")
      ?.value || "";


  const params =
    new URLSearchParams();


  params.set(
    "page",
    currentLinksPage
  );


  params.set(
    "limit",
    "20"
  );


  if (search) {

    params.set(
      "search",
      search
    );
  }


  if (collectionId) {

    params.set(
      "collection_id",
      collectionId
    );
  }


  if (favorite) {

    params.set(
      "favorite",
      favorite
    );
  }


  try {

    const result =
      await apiRequest(
        `/api/links?${params.toString()}`
      );


    renderLinks(
      container,
      result.data || []
    );


    renderPagination(
      result.pagination
    );


  } catch {

    container.innerHTML = `
      <div class="link-card">
        <p class="description">
          Failed to load links.
        </p>
      </div>
    `;
  }
}


/* ========================================
   RENDER LINKS
======================================== */

function renderLinks(
  container,
  links
) {

  if (!container) return;


  if (!links.length) {

    container.innerHTML = `
      <div class="link-card">
        <p class="description">
          No links found.
        </p>
      </div>
    `;

    return;
  }


  container.innerHTML =
    links
      .map((link) => {

        const collection =
          collections.find(
            (item) =>
              Number(item.id) ===
              Number(
                link.collection_id
              )
          );


        return `
          <article class="link-card">

            <h3>
              ${escapeHtml(
                link.title
              )}
            </h3>

            <div class="url">
              ${escapeHtml(
                link.url
              )}
            </div>

            ${
              link.description
                ? `
                  <div class="description">
                    ${escapeHtml(
                      link.description
                    )}
                  </div>
                `
                : ""
            }

            ${
              collection
                ? `
                  <span class="collection">
                    ${escapeHtml(
                      collection.name
                    )}
                  </span>
                `
                : ""
            }

          </article>
        `;

      })
      .join("");
}


/* ========================================
   HOME
======================================== */

async function loadHome() {

  renderHomeCollections();


  try {

    const result =
      await apiRequest(
        "/api/links?page=1&limit=5"
      );


    renderLinks(
      $("#recent-links"),
      result.data || []
    );


  } catch (error) {

    console.error(
      "Failed to load recent links:",
      error
    );
  }
}


/* ========================================
   HOME COLLECTIONS
======================================== */

function renderHomeCollections() {

  const container =
    $("#home-collections");

  if (!container) return;


  if (!collections.length) {

    container.innerHTML = `
      <div class="category-card">

        <h4>
          No collections
        </h4>

        <p>
          Create one in Organize.
        </p>

      </div>
    `;

    return;
  }


  container.innerHTML =
    collections
      .map(
        (collection) => `
          <div
            class="category-card"
            onclick="openCollectionLinks(${collection.id})"
          >

            <h4>
              ${escapeHtml(
                collection.name
              )}
            </h4>

            <p>
              Open collection
            </p>

          </div>
        `
      )
      .join("");
}


/* ========================================
   OPEN COLLECTION
======================================== */

function openCollectionLinks(id) {

  showPage("links");


  const filter =
    $("#collection-filter");


  if (filter) {

    filter.value =
      String(id);
  }


  currentLinksPage = 1;

  loadLinks();
}


/* ========================================
   PAGINATION
======================================== */

function renderPagination(
  pagination
) {

  const container =
    $("#pagination");


  if (!container || !pagination) {

    return;
  }


  if (
    pagination.totalPages <= 1
  ) {

    container.innerHTML = "";

    return;
  }


  container.innerHTML = `

    <button
      class="secondary-button"
      ${
        !pagination.hasPreviousPage
          ? "disabled"
          : ""
      }
      onclick="changeLinksPage(
        ${pagination.page - 1}
      )"
    >
      Previous
    </button>


    <span>
      Page ${pagination.page}
      of ${pagination.totalPages}
    </span>


    <button
      class="secondary-button"
      ${
        !pagination.hasNextPage
          ? "disabled"
          : ""
      }
      onclick="changeLinksPage(
        ${pagination.page + 1}
      )"
    >
      Next
    </button>

  `;
}


function changeLinksPage(page) {

  if (page < 1) return;


  currentLinksPage =
    page;


  loadLinks();
}


/* ========================================
   SEARCH
======================================== */

$("#home-search")
  ?.addEventListener(
    "input",
    () => {

      clearTimeout(
        homeSearchTimer
      );


      homeSearchTimer =
        setTimeout(
          searchFromHome,
          300
        );
    }
  );


function searchFromHome() {

  const value =
    $("#home-search")
      .value
      .trim();


  showPage("links");


  $("#links-search").value =
    value;


  currentLinksPage = 1;

  loadLinks();
}


$("#links-search")
  ?.addEventListener(
    "input",
    () => {

      clearTimeout(
        linksSearchTimer
      );


      linksSearchTimer =
        setTimeout(
          () => {

            currentLinksPage = 1;

            loadLinks();

          },
          300
        );
    }
  );


/* ========================================
   FILTERS
======================================== */

$("#collection-filter")
  ?.addEventListener(
    "change",
    () => {

      currentLinksPage = 1;

      loadLinks();
    }
  );


$("#favorite-filter")
  ?.addEventListener(
    "change",
    () => {

      currentLinksPage = 1;

      loadLinks();
    }
  );


/* ========================================
   HTML ESCAPING
======================================== */

function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";
  }


  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );
}


/* ========================================
   APPLICATION INITIALIZATION
======================================== */

async function initializeApp() {

  try {

    await loadCollections();

    showPage("home");


  } catch (error) {

    console.error(
      "Application initialization failed:",
      error
    );
  }
}


/* ========================================
   START APPLICATION
======================================== */

/*
  Wait for the page and Clerk script
  to finish loading.
*/

window.addEventListener(
  "load",
  initializeClerk
);