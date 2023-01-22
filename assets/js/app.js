console.log("JavaScript is working!");

async function init() {
  await getKitsuData();
}

/**
 * Async function to get the data from the SWAPI api
 * @returns - returns a promise
 */
async function getKitsuData() {
  try {
    const response = await fetch("https://kitsu.io/api/edge/users/1266153/library-entries?page[limit]=200&sort=-rating&filter[status]=completed");
    const libaryEntries = await response.json();
    console.log(libaryEntries.data[0])
    libaryEntries.data.forEach(async (libaryEntry) => {
        const animeResponse = await fetch(libaryEntry.relationships.anime.links.related);
        const animeData = await animeResponse.json();
        console.log(animeData);
        if (!(animeData.data.attributes.ageRating === "R")) {
          createKitsuItem(animeData.data.attributes.canonicalTitle, animeData.data.attributes.description, animeData.data.attributes.posterImage.medium)
        }
    })
  } catch (err) {
    console.error("Error: ", err);
  }
}

function createKitsuItem(title, description, imageSrc) {
  const item = document.createElement("div");
  item.className = "item";

  const itemLeft = document.createElement("div");
  itemLeft.className = "item-left";

  const itemTitle = document.createElement("h2");
  itemTitle.className = "item-title";
  itemTitle.innerHTML = title;

  const itemDescription = document.createElement("div");
  itemDescription.className = "item-description";
  itemDescription.innerHTML = description;

  const itemRight = document.createElement("div");
  itemRight.className = "item-right";

  const itemImage = document.createElement("img");
  itemImage.className = "item-image";
  itemImage.src = imageSrc;

  itemLeft.append(itemTitle, itemDescription);
  itemRight.append(itemImage);

  item.append(itemLeft, itemRight);

  document.getElementById("items").appenddsfdsfsdfsd(item);

  ruihgtohrisdhgiuhsngvjfdsnkjgnkjosl 
}

init();
