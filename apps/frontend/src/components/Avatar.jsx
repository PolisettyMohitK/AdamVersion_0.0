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
    setLipsync(message.lipsync);
    
    // Play audio if available
    if (message.audio) {
      try {
        // Determine the correct MIME type based on the audio data
        // Since we're creating WAV files, we should use audio/wav
        const mimeType = "audio/wav";
        const audio = new Audio(`data:${mimeType};base64,${message.audio}`);
        
        // Add event listeners for debugging
        audio.addEventListener('loadedmetadata', () => {
          console.log(`Audio duration: ${audio.duration}`);
        });
        
        audio.addEventListener('play', () => {
          console.log('Audio started playing');
        });
        
        audio.addEventListener('timeupdate', () => {
          // Uncomment for detailed timing debug
          // console.log(`Audio current time: ${audio.currentTime}`);
        });
        
        audio.play().catch(error => {
          console.error("Error playing audio:", error);
        });
        setAudio(audio);
        setCurrentAudio(audio); // Set the current audio in the context
        audio.onended = () => {
          console.log("Audio finished playing");
          onMessagePlayed();
        };
      } catch (error) {
        console.error("Error creating or playing audio:", error);
        // Still call onMessagePlayed to continue the flow
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

    // Handle lipsync with direct processing (no state delay)
    if (message && lipsync && audio) {
      try {
        const currentAudioTime = audio.currentTime;
        
        // Directly calculate and apply visemes in this frame
        const activeTargets = new Set();
        
        if (lipsync.mouthCues) {
          // Process all cues to find active ones
          lipsync.mouthCues.forEach((mouthCue) => {
            if (currentAudioTime >= mouthCue.start && currentAudioTime <= mouthCue.end) {
              const target = visemesMapping[mouthCue.value];
              if (target) {
                // Calculate progress within this cue (0 to 1)
                const progress = (currentAudioTime - mouthCue.start) / (mouthCue.end - mouthCue.start);
                // Ease in/out for smoother transitions
                const easedProgress = progress < 0.5 
                  ? 2 * progress * progress 
                  : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
                lerpMorphTarget(target, easedProgress, 0.3);
                activeTargets.add(target);
              }
            }
          });
          
          // If no active cues but we're near the end, hold the last viseme
          if (activeTargets.size === 0 && lipsync.mouthCues.length > 0) {
            const lastCue = lipsync.mouthCues[lipsync.mouthCues.length - 1];
            if (currentAudioTime > lastCue.end && currentAudioTime < lastCue.end + 0.3) {
              const target = visemesMapping[lastCue.value];
              if (target) {
                lerpMorphTarget(target, 0.4, 0.2);
                activeTargets.add(target);
              }
            }
          }
        }
        
        // Reset unused visemes with appropriate speed
        Object.values(visemesMapping).forEach((target) => {
          if (!activeTargets.has(target)) {
            lerpMorphTarget(target, 0, 0.15);
          }
        });
      } catch (error) {
        console.error("Error processing lipsync:", error);
        // Fallback: reset all visemes
        Object.values(visemesMapping).forEach((target) => {
          lerpMorphTarget(target, 0, 0.1);
        });
      }
    } else {
      // Reset all visemes when not processing lipsync
      Object.values(visemesMapping).forEach((target) => {
        lerpMorphTarget(target, 0, 0.1);
      });
    }
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