import re

with open('components/marketing/TemplateSelectionView.tsx', 'r') as f:
    content = f.read()

old_thumbnail = """                  <div className="aspect-[3/4] bg-white relative p-4 flex flex-col">
                    <div className="w-full h-4 bg-gray-200 rounded mb-4" />
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                        <img src={template.image} className="w-full h-full object-cover opacity-50 mix-blend-multiply" />
                      </div>
                    </div>
                    <div className="w-3/4 h-2 bg-gray-200 rounded mt-4 mx-auto" />
                    <div className="w-1/2 h-2 bg-gray-200 rounded mt-2 mx-auto" />
                    
                    {/* Hover Overlay */}"""

new_thumbnail = """                  <div className="aspect-[3/4] bg-white relative flex flex-col overflow-hidden pointer-events-none">
                    
                    {/* Dynamic Thumbnail Content */}
                    <div className="w-full h-full transform scale-[0.6] origin-top flex flex-col gap-2 p-2">
                      
                      {template.id === 'default' && (
                        <div className="flex flex-col items-center gap-2 mt-4">
                          <div className="w-2/3 h-4 bg-gray-800 rounded"></div>
                          <div className="w-full h-24 bg-gray-200 rounded-lg overflow-hidden">
                            <img src={template.image} className="w-full h-full object-cover" />
                          </div>
                          <div className="w-1/2 h-3 bg-gray-800 rounded mt-2"></div>
                          <div className="w-full h-2 bg-gray-300 rounded"></div>
                          <div className="w-5/6 h-2 bg-gray-300 rounded"></div>
                          <div className="w-1/3 h-6 bg-blue-600 rounded-lg mt-2"></div>
                        </div>
                      )}

                      {template.id === 'sell' && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-full h-20 bg-gray-200 rounded-t-lg overflow-hidden -mx-2 -mt-2 w-[calc(100%+16px)]">
                            <img src={template.image} className="w-full h-full object-cover" />
                          </div>
                          <div className="w-3/4 h-4 bg-gray-800 rounded mt-2"></div>
                          <div className="w-full h-2 bg-gray-300 rounded"></div>
                          <div className="grid grid-cols-3 gap-2 w-full mt-2">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div className="w-full aspect-square bg-gray-100 rounded"></div>
                                <div className="w-3/4 h-1.5 bg-gray-800 rounded"></div>
                                <div className="w-full h-1 bg-gray-300 rounded"></div>
                                <div className="w-full h-3 bg-black rounded mt-1"></div>
                              </div>
                            ))}
                          </div>
                          <div className="w-full h-12 bg-gray-100 rounded-lg mt-2 flex flex-col items-center justify-center gap-1">
                            <div className="w-1/3 h-3 bg-gray-800 rounded"></div>
                            <div className="w-1/2 h-1.5 bg-gray-400 rounded"></div>
                          </div>
                        </div>
                      )}

                      {template.id === 'story' && (
                        <div className="flex flex-col gap-2">
                          <div className="w-full h-16 bg-gray-200 rounded-t-lg overflow-hidden -mx-2 -mt-2 w-[calc(100%+16px)]">
                            <img src={template.image} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-1/2 h-16 bg-gray-200 rounded"></div>
                            <div className="w-1/2 flex flex-col gap-1.5">
                              <div className="w-full h-3 bg-gray-800 rounded"></div>
                              <div className="w-full h-1.5 bg-gray-300 rounded"></div>
                              <div className="w-3/4 h-1.5 bg-gray-300 rounded"></div>
                              <div className="w-1/3 h-1.5 bg-black rounded mt-1"></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-row-reverse mt-2">
                            <div className="w-1/2 h-16 bg-gray-200 rounded"></div>
                            <div className="w-1/2 flex flex-col gap-1.5">
                              <div className="w-full h-3 bg-gray-800 rounded"></div>
                              <div className="w-full h-1.5 bg-gray-300 rounded"></div>
                              <div className="w-5/6 h-1.5 bg-gray-300 rounded"></div>
                              <div className="w-1/3 h-1.5 bg-black rounded mt-1"></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {template.id === 'event' && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-full h-16 bg-gray-200 rounded-t-lg overflow-hidden -mx-2 -mt-2 w-[calc(100%+16px)]">
                            <img src={template.image} className="w-full h-full object-cover" />
                          </div>
                          <div className="w-2/3 h-6 bg-black rounded-lg mt-2"></div>
                          <div className="w-full h-px bg-gray-200 my-1"></div>
                          <div className="w-1/2 h-3 bg-gray-800 rounded mt-1"></div>
                          <div className="grid grid-cols-3 gap-2 w-full mt-1">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                                <div className="w-3/4 h-1.5 bg-gray-800 rounded"></div>
                                <div className="w-1/2 h-1 bg-gray-400 rounded"></div>
                              </div>
                            ))}
                          </div>
                          <div className="w-1/2 h-4 bg-gray-800 rounded mt-2"></div>
                        </div>
                      )}

                      {template.id === 'simple' && (
                        <div className="flex flex-col gap-2 p-2 mt-4">
                          <div className="w-1/3 h-2 bg-gray-800 rounded mb-2"></div>
                          <div className="w-full h-1.5 bg-gray-400 rounded"></div>
                          <div className="w-full h-1.5 bg-gray-400 rounded"></div>
                          <div className="w-5/6 h-1.5 bg-gray-400 rounded"></div>
                          <div className="w-full h-1.5 bg-gray-400 rounded mt-2"></div>
                          <div className="w-3/4 h-1.5 bg-gray-400 rounded"></div>
                          <div className="w-1/4 h-2 bg-gray-800 rounded mt-4"></div>
                          <div className="w-1/3 h-1.5 bg-blue-600 rounded mt-4"></div>
                        </div>
                      )}

                    </div>

                    {/* Hover Overlay */}"""

content = content.replace(old_thumbnail, new_thumbnail)

with open('components/marketing/TemplateSelectionView.tsx', 'w') as f:
    f.write(content)

print("Thumbnails patched")
