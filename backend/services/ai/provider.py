import json
import logging
import httpx
from typing import Type, TypeVar
import google.generativeai as genai
from pydantic import BaseModel
from backend.config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

# Determine if this is an OpenRouter key
is_openrouter = str(GEMINI_API_KEY).startswith("sk-or-")

if GEMINI_API_KEY:
    if not is_openrouter:
        genai.configure(api_key=GEMINI_API_KEY)
    else:
        logger.info("OpenRouter API key detected. Switching provider mode to HTTP completions.")
else:
    logger.warning("GEMINI_API_KEY is not set. Gemini calls will fail.")

T = TypeVar("T", bound=BaseModel)

class GeminiProvider:
    def __init__(self, model_name: str = "gemini-2.5-flash"):
        self.model_name = model_name
        if not is_openrouter and GEMINI_API_KEY:
            self.client = genai.GenerativeModel(model_name)

    def generate_text(self, prompt: str) -> str:
        if not GEMINI_API_KEY:
            return "Gemini API key is not configured. Please set the GEMINI_API_KEY environment variable."
        
        if is_openrouter:
            return self._generate_openrouter_text(prompt)
            
        try:
            response = self.client.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Error in Gemini text generation: {e}")
            return f"Error: {str(e)}"

    def generate_structured(self, prompt: str, response_model: Type[T]) -> T:
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not configured.")

        # Construct schema description for prompts
        schema_json = response_model.model_json_schema()
        system_instruction = (
            f"You are a structured data generator. You MUST output ONLY valid JSON. "
            f"Do not include any markdown formatting (like ```json), code blocks, or extra text. "
            f"The output must strictly conform to this JSON Schema:\n{json.dumps(schema_json)}"
        )
        full_prompt = f"{system_instruction}\n\nUser request: {prompt}"

        if is_openrouter:
            return self._generate_openrouter_structured(full_prompt, response_model)

        try:
            response = self.client.generate_content(
                full_prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            
            clean_text = response.text.strip()
            # Clean markdown code blocks if returned
            if clean_text.startswith("```"):
                lines = clean_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                clean_text = "\n".join(lines).strip()
            
            data = json.loads(clean_text)
            return response_model.model_validate(data)
        except Exception as e:
            logger.error(f"Error in Gemini structured generation: {e}. Text: {response.text if 'response' in locals() else 'None'}")
            raise e

    def _generate_openrouter_text(self, prompt: str) -> str:
        # Map model name to OpenRouter name
        or_model = f"google/{self.model_name}" if "google/" not in self.model_name else self.model_name
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GEMINI_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": or_model,
                        "messages": [{"role": "user", "content": prompt}]
                    }
                )
                try:
                    resp.raise_for_status()
                except httpx.HTTPStatusError as http_err:
                    logger.error(f"OpenRouter HTTP Error: {http_err.response.status_code} - {http_err.response.text}")
                    raise http_err
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"OpenRouter text generation failed: {e}")
            return f"Error: {str(e)}"

    def _generate_openrouter_structured(self, full_prompt: str, response_model: Type[T]) -> T:
        or_model = f"google/{self.model_name}" if "google/" not in self.model_name else self.model_name
        try:
            with httpx.Client(timeout=45.0) as client:
                resp = client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GEMINI_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": or_model,
                        "messages": [{"role": "user", "content": full_prompt}],
                        "response_format": {"type": "json_object"}
                    }
                )
                try:
                    resp.raise_for_status()
                except httpx.HTTPStatusError as http_err:
                    logger.error(f"OpenRouter Structured HTTP Error: {http_err.response.status_code} - {http_err.response.text}")
                    raise http_err
                    
                result_data = resp.json()
                clean_text = result_data["choices"][0]["message"]["content"].strip()
                
                # Strip markdown fence blocks if present
                if clean_text.startswith("```"):
                    lines = clean_text.splitlines()
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    clean_text = "\n".join(lines).strip()
                    
                data = json.loads(clean_text)
                return response_model.model_validate(data)
        except Exception as e:
            logger.error(f"OpenRouter structured generation failed: {e}")
            raise e
