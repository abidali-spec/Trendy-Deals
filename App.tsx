import React, { useState, useCallback, useRef, useEffect } from 'react';
import { removeBackground } from './services/geminiService';
import { UploadIcon, DownloadIcon, SparklesIcon, BackIcon, ImageIcon } from './components/Icons';
import Spinner from './components/Spinner';

interface ImageState {
  file: File;
  dataUrl: string;
}

const App: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<ImageState | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<ImageState | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<'png' | 'jpeg' | 'passport'>('png');
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file (PNG, JPG, etc.).');
        return;
      }
      resetState();
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage({ file, dataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackgroundFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file for the background.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImage({ file, dataUrl: reader.result as string });
        setOutputFormat('png'); // Default to PNG when new background is set
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerBackgroundUpload = () => {
    backgroundInputRef.current?.click();
  };

  const handleRemoveBackground = useCallback(async () => {
    if (!originalImage) return;

    setIsLoading(true);
    setError(null);
    setProcessedImage(null);

    try {
      const base64Data = originalImage.dataUrl.split(',')[1];
      const resultBase64 = await removeBackground(base64Data, originalImage.file.type);
      setProcessedImage(`data:image/png;base64,${resultBase64}`);
    } catch (err) {
      console.error(err);
      setError('Failed to remove background. Please try another image.');
    } finally {
      setIsLoading(false);
    }
  }, [originalImage]);

  const resetState = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setBackgroundImage(null);
    setFinalImage(null);
    setIsLoading(false);
    setError(null);
    setOutputFormat('png');
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
    if(backgroundInputRef.current) backgroundInputRef.current.value = '';
  };

  useEffect(() => {
    if (!processedImage || !backgroundImage) {
      setFinalImage(null);
      return;
    }

    const subjectImg = new Image();
    const backgroundImg = new Image();
    let subjectLoaded = false;
    let backgroundLoaded = false;

    const compositeImages = () => {
        if (!subjectLoaded || !backgroundLoaded) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setError('Could not create image canvas.');
            return;
        }

        canvas.width = subjectImg.width;
        canvas.height = subjectImg.height;

        const bgAspectRatio = backgroundImg.width / backgroundImg.height;
        const canvasAspectRatio = canvas.width / canvas.height;
        let sx = 0, sy = 0, sWidth = backgroundImg.width, sHeight = backgroundImg.height;

        if (bgAspectRatio > canvasAspectRatio) {
            sWidth = backgroundImg.height * canvasAspectRatio;
            sx = (backgroundImg.width - sWidth) / 2;
        } else {
            sHeight = backgroundImg.width / canvasAspectRatio;
            sy = (backgroundImg.height - sHeight) / 2;
        }
        ctx.drawImage(backgroundImg, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        ctx.drawImage(subjectImg, 0, 0);
        setFinalImage(canvas.toDataURL('image/png'));
    };

    subjectImg.onload = () => { subjectLoaded = true; compositeImages(); };
    backgroundImg.onload = () => { backgroundLoaded = true; compositeImages(); };
    subjectImg.onerror = () => setError('Failed to load subject image for composition.');
    backgroundImg.onerror = () => setError('Failed to load background image for composition.');

    subjectImg.src = processedImage;
    backgroundImg.src = backgroundImage.dataUrl;

  }, [processedImage, backgroundImage]);

  const downloadImage = () => {
    if (!processedImage) return;

    const originalFileName = originalImage?.file.name.split('.')[0] ?? 'image';
    const link = document.createElement('a');

    if (outputFormat === 'passport') {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { return; }
            const outputSize = 600;
            canvas.width = outputSize;
            canvas.height = outputSize;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, outputSize, outputSize);
            const cropSize = Math.min(img.width, img.height);
            const cropX = (img.width - cropSize) / 2;
            const cropY = (img.height - cropSize) / 2;
            ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, outputSize, outputSize);
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.download = `passport-${originalFileName}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        img.onerror = () => setError('Failed to load processed image for passport conversion.');
        img.src = processedImage;
        return;
    }

    if (outputFormat === 'png' && !backgroundImage) {
        link.href = processedImage;
        link.download = `bg-removed-${originalFileName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    const imageToRenderOnCanvas = finalImage || processedImage;
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { return; }
        canvas.width = img.width;
        canvas.height = img.height;
        if (outputFormat === 'jpeg' && !backgroundImage) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        const isJpg = outputFormat === 'jpeg';
        const mimeType = isJpg ? 'image/jpeg' : 'image/png';
        const fileExtension = isJpg ? 'jpg' : 'png';
        const namePrefix = backgroundImage ? 'composite' : 'bg-removed';
        link.href = canvas.toDataURL(mimeType, 0.95);
        link.download = `${namePrefix}-${originalFileName}.${fileExtension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    img.onerror = () => setError('Failed to load final image for conversion.');
    img.src = imageToRenderOnCanvas;
  };

  const renderInitialState = () => (
    <div className="w-full max-w-lg text-center">
      <h2 className="text-3xl font-bold mb-4 text-gray-100">Upload an Image to Begin</h2>
      <p className="text-gray-400 mb-8">Let our AI magically remove the background for you.</p>
      <div className="relative border-2 border-dashed border-gray-600 rounded-xl p-8 hover:border-indigo-500 transition-colors duration-300 bg-gray-800/50">
        <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
        <label htmlFor="file-upload" className="relative cursor-pointer mt-4 text-indigo-400 font-semibold focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-indigo-500">
          <span>Select a file</span>
          <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
        </label>
        <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</p>
      </div>
      {error && <p className="mt-4 text-red-400">{error}</p>}
    </div>
  );

  const renderProcessingState = () => {
    const displayImage = finalImage || processedImage;
    return (
        <div className="flex flex-col md:flex-row gap-8 items-center justify-center w-full">
            <div className="w-full md:w-1/2 max-w-sm aspect-square bg-gray-800 rounded-2xl shadow-lg flex items-center justify-center p-4">
                <img src={originalImage!.dataUrl} alt="Original" className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
            <div className="w-full md:w-1/2 max-w-sm aspect-square bg-gray-800 rounded-2xl shadow-lg flex flex-col items-center justify-center p-4">
                {isLoading ? (
                <>
                    <Spinner />
                    <p className="text-gray-400 mt-4 text-center">Removing background...</p>
                    <p className="text-xs text-gray-500 mt-2 text-center">This may take a moment.</p>
                </>
                ) : displayImage ? (
                <img src={displayImage} alt="Processed" className="max-w-full max-h-full object-contain rounded-lg" style={!finalImage ? {backgroundImage: 'repeating-conic-gradient(#374151 0% 25%, transparent 0% 50%)', backgroundSize: '16px 16px'} : {}}/>
                ) : (
                <div className="text-center">
                    <p className="text-red-400">{error || 'An unexpected error occurred.'}</p>
                </div>
                )}
            </div>
        </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-3">
             <SparklesIcon className="w-10 h-10 text-indigo-400" />
             <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
                AI Background Remover
             </h1>
          </div>
        </header>

        <main className="flex items-center justify-center">
          <input type="file" ref={backgroundInputRef} onChange={handleBackgroundFileChange} className="hidden" accept="image/*"/>
          {!originalImage ? renderInitialState() : renderProcessingState()}
        </main>
        
        {originalImage && (
          <footer className="mt-10 flex flex-wrap gap-4 justify-center items-center">
            {!processedImage && !isLoading && (
              <button
                onClick={handleRemoveBackground}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all"
              >
                <SparklesIcon className="w-5 h-5 mr-2"/>
                Remove Background
              </button>
            )}

            {isLoading && (
              <button disabled className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all">
                <Spinner/>
                <span className="ml-2">Processing...</span>
              </button>
            )}

            {processedImage && (
              <>
                <button
                  onClick={triggerBackgroundUpload}
                  className="inline-flex items-center justify-center px-6 py-3 border border-gray-600 text-base font-medium rounded-md shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500 transition-all"
                >
                  <ImageIcon className="w-5 h-5 mr-2"/>
                  {backgroundImage ? 'Change Background' : 'Add Background'}
                </button>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <select
                      id="format-select"
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value as 'png' | 'jpeg' | 'passport')}
                      className="appearance-none w-full bg-gray-700 border border-gray-600 text-gray-300 text-base font-medium rounded-md pl-4 pr-10 py-3 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500 transition-all"
                      aria-label="Select output image format"
                    >
                      {backgroundImage ? (
                        <>
                          <option value="png">PNG (with background)</option>
                          <option value="jpeg">JPG (with background)</option>
                        </>
                      ) : (
                        <>
                          <option value="png">PNG (transparent)</option>
                          <option value="jpeg">JPG (white bg)</option>
                          <option value="passport">Passport Photo (JPG)</option>
                        </>
                      )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  <button
                    onClick={downloadImage}
                    className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 transition-all"
                  >
                    <DownloadIcon className="w-5 h-5 mr-2"/>
                    Download
                  </button>
                </div>
              </>
            )}
            <button
                onClick={resetState}
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-600 text-base font-medium rounded-md shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500 transition-all"
              >
                <BackIcon className="w-5 h-5 mr-2"/>
                Start Over
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};

export default App;
