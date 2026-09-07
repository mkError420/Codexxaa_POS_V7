/**
 * Fuzzy Product Matcher - Client-side JavaScript Integration
 * 
 * This module provides functions to send search queries (OCR results or manual input)
 * to the PHP fuzzy matching API and handle the matched product suggestions.
 * 
 * USAGE EXAMPLES:
 * 
 * 1. Basic usage with OCR result:
 *    const matches = await matchProduct('Secl0 20ng', 1);
 *    console.log(matches);
 * 
 * 2. With manual input:
 *    const matches = await matchProduct('napa', 1);
 *    if (matches.length > 0) {
 *      console.log('Best match:', matches[0]);
 *    }
 * 
 * 3. With error handling:
 *    try {
 *      const matches = await matchProduct('medicine name', 1);
 *      renderMatchSuggestions(matches);
 *    } catch (error) {
 *      console.error('Matching failed:', error);
 *    }
 */

import API_BASE_URL from '../config';

/**
 * Match a search query against tenant products using fuzzy string matching
 * 
 * @param {string} searchQuery - The search text (OCR result or manual input)
 * @param {number} tenantId - The tenant ID for data isolation
 * @returns {Promise<Array>} Array of matched products with confidence scores
 * 
 * @throws {Error} If the API request fails
 */
export async function matchProduct(searchQuery, tenantId) {
  if (!searchQuery || typeof searchQuery !== 'string') {
    throw new Error('searchQuery must be a non-empty string');
  }

  if (!tenantId || typeof tenantId !== 'number' || tenantId <= 0) {
    throw new Error('tenantId must be a positive integer');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/match_product.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        search_query: searchQuery.trim(),
        tenant_id: tenantId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Matching failed');
    }

    return data.matches || [];

  } catch (error) {
    console.error('[FuzzyMatcher] Error matching product:', error);
    throw error;
  }
}

/**
 * Match product and automatically select the best match
 * 
 * @param {string} searchQuery - The search text
 * @param {number} tenantId - The tenant ID
 * @param {number} minConfidence - Minimum confidence score to accept (default: 70)
 * @returns {Promise<Object|null>} The best matching product or null if below threshold
 */
export async function matchBestProduct(searchQuery, tenantId, minConfidence = 70) {
  try {
    const matches = await matchProduct(searchQuery, tenantId);
    
    if (matches.length === 0) {
      return null;
    }

    const bestMatch = matches[0];
    
    // Check if the best match meets the minimum confidence threshold
    if (bestMatch.confidence_score >= minConfidence) {
      return bestMatch;
    }

    return null;

  } catch (error) {
    console.error('[FuzzyMatcher] Error matching best product:', error);
    return null;
  }
}

/**
 * Render match suggestions in a dropdown or list
 * 
 * @param {Array} matches - Array of matched products from matchProduct()
 * @param {HTMLElement} container - The DOM element to render suggestions in
 * @param {Function} onSelect - Callback function when a product is selected
 */
export function renderMatchSuggestions(matches, container, onSelect) {
  if (!container) {
    console.error('[FuzzyMatcher] Container element is required');
    return;
  }

  // Clear previous suggestions
  container.innerHTML = '';

  if (matches.length === 0) {
    container.innerHTML = '<div class="text-gray-500 text-sm">No matches found</div>';
    return;
  }

  // Create suggestion list
  const list = document.createElement('div');
  list.className = 'fuzzy-match-suggestions';

  matches.forEach((match, index) => {
    const item = document.createElement('div');
    item.className = 'fuzzy-match-item';
    item.innerHTML = `
      <div class="flex justify-between items-center p-2 hover:bg-gray-100 cursor-pointer rounded">
        <div>
          <div class="font-medium text-sm">${escapeHtml(match.name)}</div>
          <div class="text-xs text-gray-500">
            SKU: ${escapeHtml(match.sku || 'N/A')} | 
            Stock: ${match.stock_quantity || 0}
          </div>
        </div>
        <div class="text-right">
          <div class="font-bold text-sm">${formatPrice(match.price)}</div>
          <div class="text-xs text-indigo-600 font-semibold">
            ${Math.round(match.confidence_score)}% match
          </div>
        </div>
      </div>
    `;

    // Add click handler
    item.addEventListener('click', () => {
      if (typeof onSelect === 'function') {
        onSelect(match);
      }
    });

    list.appendChild(item);
  });

  container.appendChild(list);
}

/**
 * Log match results to console for debugging
 * 
 * @param {string} searchQuery - The original search query
 * @param {Array} matches - Array of matched products
 */
export function logMatchResults(searchQuery, matches) {
  console.log('[FuzzyMatcher] Search Query:', searchQuery);
  console.log('[FuzzyMatcher] Matches Found:', matches.length);
  
  if (matches.length > 0) {
    console.log('[FuzzyMatcher] Best Match:', matches[0]);
    console.table(matches);
  } else {
    console.log('[FuzzyMatcher] No matches found');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format price with currency symbol
 */
function formatPrice(price) {
  const currency = '৳'; // Default currency, can be parameterized
  return `${currency}${parseFloat(price || 0).toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE USAGE IN REACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/*
import { matchProduct, matchBestProduct, renderMatchSuggestions } from '../utils/fuzzyMatcher';

function ProductSearch({ tenantId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const suggestionsRef = useRef(null);

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchTerm(query);

    if (query.length < 2) {
      setMatches([]);
      return;
    }

    setLoading(true);
    try {
      const results = await matchProduct(query, tenantId);
      setMatches(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (product) => {
    console.log('Selected product:', product);
    // Add to cart or perform other action
    setMatches([]);
    setSearchTerm('');
  };

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={handleSearch}
        placeholder="Search products..."
        className="border rounded p-2"
      />
      {loading && <div className="text-sm text-gray-500">Searching...</div>}
      <div ref={suggestionsRef} />
      {matches.length > 0 && (
        renderMatchSuggestions(matches, suggestionsRef.current, handleSelectProduct)
      )}
    </div>
  );
}
*/
