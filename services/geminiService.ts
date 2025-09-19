
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Removes the background from an image using the Gemini API.
 * @param base64ImageData The base64 encoded image data (without the data URL prefix).
 * @param mimeType The MIME type of the image (e.g., 'image/jpeg').
 * @returns A promise that resolves to the base64 encoded string of the processed image.
 */
export const removeBackground = async (base64ImageData: string, mimeType: string): Promise<string> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64ImageData,
              mimeType: mimeType,
            },
          },
          {
            text: 'Remove the background of this image. The main subject should be preserved perfectly. The output must be a PNG with a transparent background.',
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    // Find the image part in the response
    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData
    );

    if (imagePart && imagePart.inlineData) {
      return imagePart.inlineData.data;
    } else {
      // Check for text part which might contain an error or refusal message
      const textPart = response.candidates?.[0]?.content?.parts?.find(
        (part) => part.text
      );
      const refusalMessage = textPart?.text || 'Model did not return an image. It might be due to safety policies or an inability to process the request.';
      throw new Error(refusalMessage);
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Re-throw a more user-friendly error
    throw new Error("Failed to communicate with the AI model. Please try again later.");
  }
};
