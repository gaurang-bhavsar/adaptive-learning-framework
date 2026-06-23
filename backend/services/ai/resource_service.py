import logging
import httpx
from typing import List
from backend.models import Resource, ResourceList
from backend.services.ai.provider import GeminiProvider

logger = logging.getLogger(__name__)

class ResourceService:
    def __init__(self, provider: GeminiProvider = None):
        self.provider = provider or GeminiProvider()

    def curate_resources(self, node_title: str, node_description: str, difficulty: str, preferred_style: str = "") -> List[Resource]:
        prompt = (
            f"Curate 2 to 4 high-quality learning resources (official documentation, videos, articles, interactive tutorials, courses, books) "
            f"for a learning step titled '{node_title}' (Description: {node_description}). "
            f"Difficulty level: {difficulty}. "
            f"Learner's preferred style: {preferred_style or 'not specified'}. "
            f"Ensure to include at least one resource matching the preferred style if specified. "
            f"Prioritize official documentation and popular free platforms (like YouTube, MDN, Real Python, freeCodeCamp, etc.)."
        )
        try:
            result = self.provider.generate_structured(prompt, ResourceList)
            # Perform lightweight URL validation on curated resources
            validated_resources = []
            for r in result.resources:
                if self.validate_url(r.url):
                    validated_resources.append(r)
                else:
                    # Fallback to search query link if invalid/broken URL
                    search_query = r.title.replace(" ", "+")
                    r.url = f"https://www.google.com/search?q={search_query}"
                    validated_resources.append(r)
            return validated_resources
        except Exception as e:
            logger.error(f"Failed to curate resources for {node_title}: {e}")
            return []

    def validate_url(self, url: str) -> bool:
        """Run a lightweight HTTP HEAD/GET request to verify the URL exists."""
        if not url.startswith("http://") and not url.startswith("https://"):
            return False
        try:
            # Short timeout to avoid blocking
            with httpx.Client(timeout=3.0, follow_redirects=True) as client:
                resp = client.head(url)
                if resp.status_code < 400:
                    return True
                # If HEAD fails or is not allowed, try GET
                resp = client.get(url)
                return resp.status_code < 400
        except Exception as e:
            logger.warning(f"URL validation failed for {url}: {e}")
            return False
