
function sortItemsByLastModified(items) {
  return items.sort((a, b) => {
    const getLastModified = (item) => {
      const metaArr = item._metadata?.calendarMetadata || [];
      const lastMod = metaArr.find(m => m.name === 'cq:lastModified');
      return lastMod ? Date.parse(lastMod.value) : 0;
    };
    return getLastModified(b) - getLastModified(a);
  });
}

async function loadContentFragments(apiPathOrUrl) {
  const { hostname } = window.location;
  // Use relative path for AEM author or publish domains
  const isAemCloud = hostname.includes('author-p131074-e1277685.adobeaemcloud.com') ||
                     hostname.includes('publish-p131074-e1277685.adobeaemcloud.com');
  // Use publish domain for preview/live... not strict for now.
  const isPreviewOrLive = hostname.includes('main--aem-eds-wknd--adobedome.aem.page') ||
                          hostname.includes('main--aem-eds-wknd--adobedome.aem.live');
  const apiBase = isAemCloud
    ? ''
    : 'https://publish-p131074-e1277685.adobeaemcloud.com';
  const apiUrl = `${apiBase}/graphql/execute.json/ref-demo-eds/ContactCardsList`;
  const cfFolder = await fetch(apiUrl);
  const cfFolderData = await cfFolder.json();
  const cfItems = Object.values(cfFolderData?.data)?.[0]?.items;
  return cfItems;
}

// Helper to get attribute value by prop name, supporting both author and publish environments
function getBlockPropValue(block, propName, order) {
  const attrDiv = block.querySelector(`[data-aue-prop="${propName}"]`);
  if (attrDiv) {
    return attrDiv.textContent?.trim() || '';
  } else if (block.children[order]) {
    return block.children[order].textContent?.trim() || '';
  }
  return '';
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('mockUserSession'));
  } catch {
    return null;
  }
}

export default function decorate(block) {
  // Get configuration from block attributes or sequential divs.
  const apiPathOrUrl = getBlockPropValue(block, 'reference', 0);
  const layout = getBlockPropValue(block, 'layout', 1) || 'verticle';
  const customStyle = getBlockPropValue(block, 'customStyle', 2);

  if (!apiPathOrUrl) return;

  // Responsive columns for grid
  function getResponsiveColumns() {
    const width = window.innerWidth;
    if (width >= 1024) return 3;
    if (width >= 600) return 2;
    return 1; // mobile
  }

  let currentColumns = getResponsiveColumns();
  let allItems = [];
  let sortedItems = [];

  // Card-based slide structure
  function createSlide(item) {
    const card = document.createElement('div');
    card.classList.add('contact-cards-card', layout);
    card.innerHTML = `
      <div class="contact-cards-card-image">
        <img src="${item.image._publishUrl}" alt="${item.title}" loading="eager" />
      </div>
      <div class="contact-cards-card-body">
        <h2>${item.title}</h2>
        <p>${item.phoneNumber?.plaintext || item.phoneNumber || ''}</p>
        ${item.ctaLabel ? `<button class="contact-cards-card-btn">${item.ctaLabel}</button>` : ''}
      </div>
    `;
    return card;
  }

  // Apply grid styles inline to override old carousel CSS
  function applyGridStyles(columns) {
    block.style.display = 'grid';
    block.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    block.style.gap = '20px';
    block.style.overflow = 'visible';
    block.style.scrollBehavior = 'auto';
  }

  function renderGrid(itemsToRender) {
    block.replaceChildren();
    currentColumns = getResponsiveColumns();
    applyGridStyles(currentColumns);
    itemsToRender.forEach(item => {
      block.append(createSlide(item));
    });
  }

  function render() {
    sortedItems = sortItemsByLastModified(allItems);
    renderGrid(sortedItems);
  }

  (async () => {
    try {
      // Fetch and process data
      const cfItems = await loadContentFragments(apiPathOrUrl);
      allItems = cfItems;
      render();

      if (customStyle) block.classList.add(customStyle);

      // Responsive: update grid columns on resize
      window.addEventListener('resize', () => {
        const newColumns = getResponsiveColumns();
        if (newColumns !== currentColumns) {
          currentColumns = newColumns;
          applyGridStyles(currentColumns);
        }
      });

    } catch (error) {
      console.error('Error loading content fragments:', error);
    }
  })();
}