import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { button, useControls } from "leva";
import React, { useEffect, useRef, useState } from "react";

import * as THREE from "three";
import { useSpeech } from "../hooks/useSpeech";
import facialExpressions from "../constants/facialExpressions";
import visemesMapping from "../constants/visemesMapping";
import morphTargets from "../constants/morphTargets";

export function Avatar(props) {
  const { nodes, materials, scene } = useGLTF("/models/avatar.glb");
  const { animations } = useGLTF("/models/animations.glb");
  const { message, onMessagePlayed, setCurrentAudio } = useSpeech(); // Added setCurrentAudio
  const [lipsync, setLipsync] = useState();
  const [setupMode, setSetupMode] = useState(false);

  useEffect(() => {
    if (!message) {
      setAnimation("Idle");
      return;
    }
    
    // Set facial expression and animation
    setFacialExpression(message.facialExpression || "default");
    setAnimation(message.animation || "TalkingOne");
    
    // Set lipsync data
    console.log("Setting lipsync data:", message.lipsync);
    if (message.lipsync && message.lipsync.mouthCues) {
      console.log(`Lip sync has ${message.lipsync.mouthCues.length} mouth cues`);
    }
    setLipsync(message.lipsync);
    
    // Play audio if available
    if (message.audio) {
      try {
        // Use format from backend if available, otherwise try MP3 first (Google TTS), then WAV (Windows TTS)
        const audioFormat = message.audioFormat || "mp3";
        const mimeType = audioFormat === "wav" ? "audio/wav" : "audio/mpeg";
        console.log(`Creating audio with format: ${audioFormat} (MIME: ${mimeType})`);
        
        const audio = new Audio(`data:${mimeType};base64,${message.audio}`);
        
        // Add event listeners for debugging and playback
        audio.addEventListener('loadedmetadata', () => {
          console.log(`Audio duration: ${audio.duration}`);
        });
        
        audio.addEventListener('play', () => {
          console.log('Audio started playing');
        });
        
        // Handle audio loading and playback
        const handleCanPlay = () => {
          console.log("Audio ready, duration:", audio.duration, "format:", audioFormat);
          audio.play().catch(error => {
            console.error("Error playing audio:", error);
            // Try alternative format as fallback
            const altFormat = audioFormat === "wav" ? "mp3" : "wav";
            const altMimeType = altFormat === "wav" ? "audio/wav" : "audio/mpeg";
            console.log(`Trying fallback format: ${altFormat}`);
            const fallbackAudio = new Audio(`data:${altMimeType};base64,${message.audio}`);
            fallbackAudio.addEventListener('canplay', () => {
              fallbackAudio.play().catch(err => {
                console.error(`${altFormat} format also failed:`, err);
                onMessagePlayed();
              });
            }, { once: true });
            fallbackAudio.addEventListener('error', () => {
              console.error("Both formats failed");
              onMessagePlayed();
            });
            setAudio(fallbackAudio);
            setCurrentAudio(fallbackAudio);
            fallbackAudio.onended = () => {
              console.log("Audio finished playing");
              onMessagePlayed();
            };
          });
        };
        
        audio.addEventListener('canplay', handleCanPlay, { once: true });
        
        audio.addEventListener('error', (e) => {
          console.error(`${audioFormat} audio error, trying alternative format:`, e);
          // Try alternative format as fallback
          const altFormat = audioFormat === "wav" ? "mp3" : "wav";
          const altMimeType = altFormat === "wav" ? "audio/wav" : "audio/mpeg";
          const fallbackAudio = new Audio(`data:${altMimeType};base64,${message.audio}`);
          fallbackAudio.addEventListener('canplay', () => {
            fallbackAudio.play().catch(err => {
              console.error(`${altFormat} format also failed:`, err);
              onMessagePlayed();
            });
          }, { once: true });
          fallbackAudio.addEventListener('error', () => {
            console.error("Both formats failed");
            onMessagePlayed();
          });
          setAudio(fallbackAudio);
          setCurrentAudio(fallbackAudio);
          fallbackAudio.onended = () => {
            console.log("Audio finished playing");
            onMessagePlayed();
          };
        });
        
        setAudio(audio);
        setCurrentAudio(audio);
        
        // Load the audio
        audio.load();
        
        audio.onended = () => {
          console.log("Audio finished playing");
          onMessagePlayed();
        };
      } catch (error) {
        console.error("Error creating audio:", error);
        onMessagePlayed();
      }
    } else {
      // If no audio, still call onMessagePlayed after a delay
      console.log("No audio data, calling onMessagePlayed after delay");
      setTimeout(onMessagePlayed, 2000);
    }
  }, [message]);

  const group = useRef();
  const { actions, mixer } = useAnimations(animations, group);
  const [animation, setAnimation] = useState(animations.find((a) => a.name === "Idle") ? "Idle" : animations[0].name);
  
  useEffect(() => {
    if (actions[animation]) {
      console.log("Playing animation:", animation);
      actions[animation]
        .reset()
        .fadeIn(mixer.stats.actions.inUse === 0 ? 0 : 0.5)
        .play();
      return () => {
        if (actions[animation]) {
          console.log("Stopping animation:", animation);
          actions[animation].fadeOut(0.5);
        }
      };
    } else {
      console.warn("Animation not found:", animation);
    }
  }, [animation]);

  const lerpMorphTarget = (target, value, speed = 0.1) => {
    scene.traverse((child) => {
      if (child.isSkinnedMesh && child.morphTargetDictionary) {
        const index = child.morphTargetDictionary[target];
        if (index === undefined || child.morphTargetInfluences[index] === undefined) {
          return;
        }
        // Use direct assignment for values close to target to prevent jitter
        const currentValue = child.morphTargetInfluences[index];
        const difference = Math.abs(currentValue - value);
        
        if (difference < 0.001) {
          // If very close to target, snap to it to prevent micro-jitter
          child.morphTargetInfluences[index] = value;
        } else {
          // Otherwise use lerp for smooth transitions
          child.morphTargetInfluences[index] = THREE.MathUtils.lerp(currentValue, value, speed);
        }
      }
    });
  };

  const [blink, setBlink] = useState(false);
  const [facialExpression, setFacialExpression] = useState("default");
  const [audio, setAudio] = useState();

  useFrame(() => {
    if (setupMode) {
      return;
    }
    
    // Handle facial expressions
    morphTargets.forEach((key) => {
      const mapping = facialExpressions[facialExpression];
      if (key === "eyeBlinkLeft" || key === "eyeBlinkRight") {
        return; // eyes wink/blink are handled separately
      }
      if (mapping && mapping[key]) {
        lerpMorphTarget(key, mapping[key], 0.1);
      } else {
        lerpMorphTarget(key, 0, 0.1);
      }
    });

    // Handle blinking
    lerpMorphTarget("eyeBlinkLeft", blink ? 1 : 0, 0.5);
    lerpMorphTarget("eyeBlinkRight", blink ? 1 : 0, 0.5);

    // Handle lipsync - sync with audio playback throughout entire conversation
    const appliedMorphTargets = [];
    if (message && lipsync && audio) {
      try {
        // Check if audio is ready and playing
        const isAudioReady = audio.readyState >= 2;
        const isAudioPlaying = !audio.paused && !audio.ended;
        
        if (isAudioReady && isAudioPlaying) {
          const currentAudioTime = audio.currentTime;
          
          // Only process if audio time is valid and positive
          if (!isNaN(currentAudioTime) && isFinite(currentAudioTime) && currentAudioTime >= 0) {
            let activeViseme = null;
            
            if (lipsync.mouthCues && Array.isArray(lipsync.mouthCues) && lipsync.mouthCues.length > 0) {
              // Process all cues - find the one that matches current time
              // This ensures lip sync works throughout the entire audio duration
              for (let i = 0; i < lipsync.mouthCues.length; i++) {
                const mouthCue = lipsync.mouthCues[i];
                if (mouthCue && typeof mouthCue.start === 'number' && typeof mouthCue.end === 'number' && mouthCue.value) {
                  // Check if current time is within this cue's time range
                  if (currentAudioTime >= mouthCue.start && currentAudioTime <= mouthCue.end) {
                    const viseme = visemesMapping[mouthCue.value];
                    if (viseme) {
                      activeViseme = viseme;
                      appliedMorphTargets.push(viseme);
                      // Calculate progress within this cue (0 to 1) for smoother transitions
                      const progress = (currentAudioTime - mouthCue.start) / (mouthCue.end - mouthCue.start);
                      // Ease in/out for smoother transitions
                      const easedProgress = progress < 0.5 
                        ? 2 * progress * progress 
                        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                      lerpMorphTarget(viseme, easedProgress, 0.3);
                    } else {
                      console.warn(`Viseme mapping not found for: ${mouthCue.value}`);
                    }
                    break; // Only apply one viseme at a time
                  }
                }
              }
              
              // If no active cues but we're near the end, hold the last viseme
              if (appliedMorphTargets.length === 0 && lipsync.mouthCues.length > 0) {
                const lastCue = lipsync.mouthCues[lipsync.mouthCues.length - 1];
                if (currentAudioTime > lastCue.end && currentAudioTime < lastCue.end + 0.3) {
                  const viseme = visemesMapping[lastCue.value];
                  if (viseme) {
                    lerpMorphTarget(viseme, 0.4, 0.2);
                    appliedMorphTargets.push(viseme);
                  }
                }
              }
            } else if (Array.isArray(lipsync) && lipsync.length > 0) {
              // Old format with array of cues
              for (let i = 0; i < lipsync.length; i++) {
                const cue = lipsync[i];
                if (cue && typeof cue.start === 'number' && typeof cue.end === 'number' && cue.value) {
                  if (currentAudioTime >= cue.start && currentAudioTime <= cue.end) {
                    const viseme = visemesMapping[cue.value];
                    if (viseme) {
                      activeViseme = viseme;
                      appliedMorphTargets.push(viseme);
                      lerpMorphTarget(viseme, 1, 0.7);
                    }
                    break;
                  }
                }
              }
            }
            
            // If no active cue found but audio is playing, use a neutral viseme
            // This prevents the mouth from staying in the last position
            if (!activeViseme && currentAudioTime > 0 && appliedMorphTargets.length === 0) {
              // Apply a subtle closed mouth position when between cues
              lerpMorphTarget("viseme_PP", 0.2, 0.2);
            }
          }
        }
      } catch (error) {
        console.error("Error processing lipsync:", error);
        // Fallback: reset all visemes
        Object.values(visemesMapping).forEach((viseme) => {
          lerpMorphTarget(viseme, 0, 0.1);
        });
      }
    } else {
      // Reset all visemes when not processing lipsync
      Object.values(visemesMapping).forEach((viseme) => {
        lerpMorphTarget(viseme, 0, 0.1);
      });
    }

    // Reset unused visemes - critical for smooth transitions throughout conversation
    // This ensures visemes don't stick and transitions are smooth
    Object.values(visemesMapping).forEach((viseme) => {
      if (!appliedMorphTargets.includes(viseme)) {
        // Reset visemes that aren't currently active
        // Use slower reset for smoother, more natural transitions
        lerpMorphTarget(viseme, 0, 0.15);
      }
    });
  });

  useControls("FacialExpressions", {
    animation: {
      value: animation,
      options: animations.map((a) => a.name),
      onChange: (value) => setAnimation(value),
    },
    facialExpression: {
      value: facialExpression,
      options: Object.keys(facialExpressions),
      onChange: (value) => setFacialExpression(value),
    },
    setupMode: button(() => {
      setSetupMode(!setupMode);
    }),
    logMorphTargetValues: button(() => {
      const emotionValues = {};
      Object.values(nodes).forEach((node) => {
        if (node.morphTargetInfluences && node.morphTargetDictionary) {
          morphTargets.forEach((key) => {
            if (key === "eyeBlinkLeft" || key === "eyeBlinkRight") {
              return;
            }
            const value = node.morphTargetInfluences[node.morphTargetDictionary[key]];
            if (value > 0.01) {
              emotionValues[key] = value;
            }
          });
        }
      });
      console.log(JSON.stringify(emotionValues, null, 2));
    }),
  });

  useControls("MorphTarget", () =>
    Object.assign(
      {},
      ...morphTargets.map((key) => {
        return {
          [key]: {
            label: key,
            value: 0,
            min: 0,
            max: 1,
            onChange: (val) => {
              lerpMorphTarget(key, val, 0.1);
            },
          },
        };
      })
    )
  );

  useEffect(() => {
    let blinkTimeout;
    const nextBlink = () => {
      blinkTimeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          nextBlink();
        }, 200);
      }, THREE.MathUtils.randInt(1000, 5000));
    };
    nextBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  return (
    <group {...props} dispose={null} ref={group} position={[0, -0.5, 0]}>
      <primitive object={nodes.Hips} />
      <skinnedMesh
        name="EyeLeft"
        geometry={nodes.EyeLeft.geometry}
        material={materials.Wolf3D_Eye}
        skeleton={nodes.EyeLeft.skeleton}
        morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary}
        morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences}
      />
      <skinnedMesh
        name="EyeRight"
        geometry={nodes.EyeRight.geometry}
        material={materials.Wolf3D_Eye}
        skeleton={nodes.EyeRight.skeleton}
        morphTargetDictionary={nodes.EyeRight.morphTargetDictionary}
        morphTargetInfluences={nodes.EyeRight.morphTargetInfluences}
      />
      <skinnedMesh
        name="Wolf3D_Head"
        geometry={nodes.Wolf3D_Head.geometry}
        material={materials.Wolf3D_Skin}
        skeleton={nodes.Wolf3D_Head.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary}
        morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences}
      />
      <skinnedMesh
        name="Wolf3D_Teeth"
        geometry={nodes.Wolf3D_Teeth.geometry}
        material={materials.Wolf3D_Teeth}
        skeleton={nodes.Wolf3D_Teeth.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary}
        morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Glasses.geometry}
        material={materials.Wolf3D_Glasses}
        skeleton={nodes.Wolf3D_Glasses.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Headwear.geometry}
        material={materials.Wolf3D_Headwear}
        skeleton={nodes.Wolf3D_Headwear.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Body.geometry}
        material={materials.Wolf3D_Body}
        skeleton={nodes.Wolf3D_Body.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Outfit_Bottom.geometry}
        material={materials.Wolf3D_Outfit_Bottom}
        skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Outfit_Footwear.geometry}
        material={materials.Wolf3D_Outfit_Footwear}
        skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Outfit_Top.geometry}
        material={materials.Wolf3D_Outfit_Top}
        skeleton={nodes.Wolf3D_Outfit_Top.skeleton}
      />
    </group>
  );
}

useGLTF.preload("/models/avatar.glb");
useGLTF.preload("/models/avatar.glb");
