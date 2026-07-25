Face injury PBR maps (optional — procedurals are used until these exist)

Place 1024x1024 (or 2048) PNGs with glTF UV (origin top-left, flipY=false):

  injury-mask-rgba.png   R=leftEye  G=rightEye  B=noseMouth  A=cheeks
  injury-albedo.png      bruise/blood color (sRGB, alpha = blend strength)
  injury-normal.png      tangent / OpenGL normals (linear)
  injury-roughness.png   grayscale: white=wet/smooth blood, dark=matte bruise

English generation prompts: src/opponent/OpponentFaceInjuryPrompts.ts
