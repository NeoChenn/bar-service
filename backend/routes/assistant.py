import os
import anthropic
from fastapi import APIRouter
from pydantic import BaseModel
from database import supabase

router = APIRouter()


class Message(BaseModel):
    role: str
    content: str


class AssistantRequest(BaseModel):
    conversation_history: list[Message]


def build_system_prompt(menu_items: list) -> str:
    menu_text = "\n".join([
        f"- {item['name']} (£{float(item['price']):.2f}) — {item['category']}"
        + (f": {item['description']}" if item['description'] else "")
        for item in menu_items
    ])
    return f"""You are a friendly menu assistant for a bar. \
Help customers decide what to order based on their preferences, \
dietary requirements, and allergies.

Current menu:
{menu_text}

Important rules:
- Only recommend items that are on the menu above
- Never claim an item is allergen-free with certainty — always tell customers to confirm allergens with staff
- Be concise and friendly
- If asked about something not on the menu, politely say it's not available
- Respond in the same language the customer writes in"""


@router.post("/")
async def menu_assistant(request: AssistantRequest):
    """
    Accepts conversation history from the frontend, fetches the current menu
    from Supabase, builds the system prompt, and returns the next assistant
    message. Menu is fetched server-side so customers cannot inject a false
    menu into the prompt via the request body.

    History is capped at the last 10 messages before sending to Claude.
    The full history is still held in frontend state — only the recent
    window is sent to the API, keeping token costs predictable.
    """
    menu_res = supabase.from_("menu_items") \
        .select("name, description, price, category") \
        .eq("available", True) \
        .execute()

    system_prompt = build_system_prompt(menu_res.data)

    capped_history = request.conversation_history[-10:]

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=500,
        system=system_prompt,
        messages=[{"role": m.role, "content": m.content} for m in capped_history],
    )

    return {"response": response.content[0].text}
