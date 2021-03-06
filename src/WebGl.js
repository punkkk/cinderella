import Triangle from './Triangle'
// import mat4 from 'gl-matrix'
import Square from './Square'

const objects = [{
  name: 'cube_first',
  textureName: ['./cube_first.gif']
}, {
  name: 'cube_sec',
  textureName: ['./cube_sec.gif']
}, {
  name: 'maze',
  textureName: ['./textures/wallpaper.gif']
}, {
  name: 'ceiling',
  textureName: ['./ceiling.gif']
}, {
  name: 'floor',
  textureName: ['./floor.gif']
},
{
  name: 'new_cube',
  textureName: ['./textures/ceilwing.gif', './textures/wallpaperrr.gif']
}]
const wallMargin = 0.1
const collisionMargin = 0.2

export default class WebGl {
  constructor () {
    this.elapsed = null
    this.canvas = null
    this.webGl = null
    this.worldSpaceLight = null
    this.perVertexProgram = null
    this.perFragmentProgram = null
    this.currentProgram = null
    this.pMatrix = mat4.create()
    this.normalMatrix = mat3.create()
    this.worldVertices = []
    this.displayedObjects = {}
    this.walls = {
      x: [],
      z: []
    }
    this.cubeVertexNormalBuffer = null
    this.cubeVertexIndexBuffer = null
    this.vertexNormals = [
      // Front face
      0.0, 0.0, 1.0,
      0.0, 0.0, 1.0,
      0.0, 0.0, 1.0,
      0.0, 0.0, 1.0,

      // Back face
      0.0, 0.0, -1.0,
      0.0, 0.0, -1.0,
      0.0, 0.0, -1.0,
      0.0, 0.0, -1.0,

      // Top face
      0.0, 1.0, 0.0,
      0.0, 1.0, 0.0,
      0.0, 1.0, 0.0,
      0.0, 1.0, 0.0,

      // Bottom face
      0.0, -1.0, 0.0,
      0.0, -1.0, 0.0,
      0.0, -1.0, 0.0,
      0.0, -1.0, 0.0,

      // Right face
      1.0, 0.0, 0.0,
      1.0, 0.0, 0.0,
      1.0, 0.0, 0.0,
      1.0, 0.0, 0.0,

      // Left face
      -1.0, 0.0, 0.0,
      -1.0, 0.0, 0.0,
      -1.0, 0.0, 0.0,
      -1.0, 0.0, 0.0
    ]
    this.cubeVertexIndices = [
      0, 1, 2, 0, 2, 3,    // Front face
      4, 5, 6, 4, 6, 7,    // Back face
      8, 9, 10, 8, 10, 11,  // Top face
      12, 13, 14, 12, 14, 15, // Bottom face
      16, 17, 18, 16, 18, 19, // Right face
      20, 21, 22, 20, 22, 23  // Left face
    ]
    this.currentlyPressedKeys = {}
    this.pitch = 0
    this.pitchRate = 0
    this.yaw = 90
    this.yawRate = 0
    this.xPos = 4.7
    this.yPos = 0.4
    this.zPos = 2.43
    this.rCubeFirst = 0
    this.rCubeSec = 0
    this.speed = 0
    this.lastTime = 0
    this.joggingAngle = 0

    try {
      this.initGl()
      this.perVertexProgram = this.initShaders('per-vertex-lighting-fs', 'per-vertex-lighting-vs')
      this.perFragmentProgram = this.initShaders('per-fragment-lighting-fs', 'per-fragment-lighting-vs')
      this.webGl.enable(this.webGl.DEPTH_TEST)
      console.info('SUCCESS: webGl initialized!')
      this.initWorld()
    } catch (error) {
      console.error(error)
    }
  }
  async initWorld () {
    let allVertices = []

    for (let i in objects) {
      const objectText = await this.loadObject(objects[i].name)
      const objectVertices = this.objectTextToVertices(objectText)
      let textures = await Promise.all(objects[i].textureName.map(textureName => this.initTexture(textureName)))
      this.displayedObjects[objects[i].name] = {
        mvMatrix: mat4.create(),
        vertices: objectVertices,
        textures
      }

      allVertices = allVertices.concat(objectVertices)
    }

    this.getWalls(allVertices)
    this.tick()
  }
  initGl () {
    this.canvas = document.getElementById('glcanvas')
    this.webGl = this.canvas.getContext('webgl', { antialias: false, stencil: true })
    this.webGl.clearColor(0.0, 0.0, 0.0, 1)
    this.webGl.clear(this.webGl.COLOR_BUFFER_BIT)
    this.webGl.viewportWidth = this.canvas.width
    this.webGl.viewportHeigth = this.canvas.height
    document.onkeydown = this.handleKeyDown.bind(this)
    document.onkeyup = this.handleKeyUp.bind(this)
  }

  degToRad (degrees) {
    return degrees * Math.PI / 180
  }

  drawScene () {
    this.webGl.viewport(0, 0, this.webGl.viewportWidth, this.webGl.viewportHeigth)
    this.webGl.clear(this.webGl.COLOR_BUFFER_BIT | this.webGl.DEPTH_BUFFER_BIT)

    mat4.perspective(90, this.webGl.viewportWidth / this.webGl.viewportHeigth, 0.1, 100.0, this.pMatrix)

    let perFragmentLighting = true
    if (perFragmentLighting) {
      this.currentProgram = this.perFragmentProgram
    } else {
      this.currentProgram = this.perVertexProgram
    }
    this.webGl.useProgram(this.currentProgram)

    for (let objectName in this.displayedObjects) {
      const texturesCount = this.displayedObjects[objectName].textures.length
      this.webGl.activeTexture(this.webGl.TEXTURE0)
      this.webGl.bindTexture(this.webGl.TEXTURE_2D, this.displayedObjects[objectName].textures[Math.floor(Math.random() * (texturesCount))])
      this.webGl.uniform1i(this.currentProgram.samplerUniform, 0)

      this.webGl.uniform1i(this.currentProgram.useLightingUniform, true)
      this.webGl.uniform3f(this.currentProgram.ambientColorUniform, 0.3, 0.3, 0.3)
      this.webGl.uniform3f(this.currentProgram.pointLightingLocationUniform, -1, 1, 1)
      this.webGl.uniform3f(this.currentProgram.pointLightingColorUniform, 0.9, 0.9, 0.9)
      this.drawSomeBitch(this.displayedObjects[objectName])
      this.webGl.uniform1i(this.currentProgram.useTexturesUniform, true)
    }
  }
  // todo rename this bitch
  drawSomeBitch (bitch) {
    const mvMatrix = bitch.mvMatrix
    if (bitch === this.displayedObjects['cube_first']) {
      this.setMatrix2(mvMatrix)
    } else if (bitch === this.displayedObjects['cube_sec']) {
      this.setMatrix3(mvMatrix)
    } else if (bitch === this.displayedObjects['light1']) {
      this.setMatrixLight(mvMatrix)
    } else if (bitch === this.displayedObjects['new_cube']) {
      this.setMatrix4(mvMatrix)
    } else {
      this.setMatrix(mvMatrix)
    }

    // this.webGl.activeTexture(this.webGl.TEXTURE0)
    // this.webGl.bindTexture(this.webGl.TEXTURE_2D, this.mainTexture)
    // this.webGl.uniform1i(this.shaderProgram.samplerUniform, 0)

    this.initNormalBuffer()
    this.webGl.bindBuffer(this.webGl.ARRAY_BUFFER, this.cubeVertexNormalBuffer)
    this.webGl.vertexAttribPointer(this.currentProgram.vertexNormalAttribute, this.cubeVertexNormalBuffer.itemSize, this.webGl.FLOAT, false, 0, 0)
    // this.initVertexIndexBuffer()
    bitch.vertices.forEach(triangleVertices => {
      let triangle = new Triangle(this.webGl, triangleVertices.vertices, triangleVertices.textureVertices)
      this.webGl.bindBuffer(this.webGl.ARRAY_BUFFER, triangle.getTextureCoordsBuffer())
      this.webGl.vertexAttribPointer(this.currentProgram.textureCoordAttribute, triangle.getTextureCoordsBuffer().itemSize, this.webGl.FLOAT, false, 0, 0)
      this.bindAndDrawArray('TRIANGLES', triangle.getPositionBuffer(), mvMatrix)
    })
  }

  initNormalBuffer () {
    this.cubeVertexNormalBuffer = this.webGl.createBuffer()
    this.webGl.bindBuffer(this.webGl.ARRAY_BUFFER, this.cubeVertexNormalBuffer)
    this.webGl.bufferData(this.webGl.ARRAY_BUFFER, new Float32Array(this.vertexNormals), this.webGl.STATIC_DRAW)
    this.cubeVertexNormalBuffer.itemSize = 3
    this.cubeVertexNormalBuffer.numItems = 24
  }

  // initVertexIndexBuffer () {
  //   this.cubeVertexIndexBuffer = this.webGl.createBuffer()
  //   this.webGl.bindBuffer(this.webGl.ELEMENT_ARRAY_BUFFER, this.cubeVertexIndexBuffer)
  //   this.webGl.bufferData(this.webGl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.cubeVertexIndices), this.webGl.STATIC_DRAW)
  //   this.cubeVertexIndexBuffer.itemSize = 1
  //   this.cubeVertexIndexBuffer.numItems = 36
  // }

  setMatrix (matrix) {
    mat4.identity(matrix)
    mat4.rotate(matrix, this.degToRad(-this.pitch), [1, 0, 0])
    mat4.rotate(matrix, this.degToRad(-this.yaw), [0, 1, 0])
    mat4.translate(matrix, [-this.xPos, -this.yPos, -this.zPos])
  }

  setMatrix2 (matrix) {
    mat4.identity(matrix)
    mat4.rotate(matrix, this.degToRad(-this.pitch), [1, 0, 0])
    mat4.rotate(matrix, this.degToRad(-this.yaw), [0, 1, 0])
    mat4.translate(matrix, [2.5, 0.5, 1.5])
    mat4.translate(matrix, [-this.xPos, -this.yPos, -this.zPos])
    mat4.rotate(matrix, this.degToRad(this.rCubeFirst), [0, 0, 1])
  }

  setMatrix3 (matrix) {
    mat4.identity(matrix)
    mat4.rotate(matrix, this.degToRad(-this.pitch), [1, 0, 0])
    mat4.rotate(matrix, this.degToRad(-this.yaw), [0, 1, 0])
    mat4.translate(matrix, [-0.5, 0.5, 1.5])
    mat4.translate(matrix, [-this.xPos, -this.yPos, -this.zPos])
    mat4.rotate(matrix, this.degToRad(this.rCubeSec), [1, 0, 0])
  }

  setMatrix4 (matrix) {
    mat4.identity(matrix)
    mat4.rotate(matrix, this.degToRad(-this.pitch), [1, 0, 0])
    mat4.rotate(matrix, this.degToRad(-this.yaw), [0, 1, 0])
    mat4.translate(matrix, [4.7, 0.1, 2.43])
    mat4.translate(matrix, [-this.xPos, -this.yPos, -this.zPos])
    mat4.rotate(matrix, this.degToRad(this.rCubeSec), [1, 0, 0])
  }

  bindAndDrawArray (arrayType, vertexPositionBuffer, mvMatrix) {
    this.webGl.bindBuffer(this.webGl.ARRAY_BUFFER, vertexPositionBuffer)
    this.webGl.vertexAttribPointer(this.currentProgram.vertexPositionAttribute, vertexPositionBuffer.itemSize, this.webGl.FLOAT, false, 0, 0)
    this.setMatrixUniform(mvMatrix)
    this.webGl.drawArrays(this.webGl[arrayType], 0, vertexPositionBuffer.numItems)
  }

  getWalls (worldVertices) {
    worldVertices.forEach( triangleVertices => {
      let verticesMap = {}
      let positionVertices = triangleVertices.vertices.slice()
      let normalizedTriangleVertices = []
      normalizedTriangleVertices.push(positionVertices.splice(0, 3))
      normalizedTriangleVertices.push(positionVertices.splice(0, 3))
      normalizedTriangleVertices.push(positionVertices)

      normalizedTriangleVertices.forEach(vertices => {
        if (verticesMap[vertices[1]]) {
          verticesMap[vertices[1]].push(vertices)
        } else {
          verticesMap[vertices[1]] = [vertices]
        }
      })

      for (let yPos in verticesMap) {
        if (verticesMap[yPos].length === 2) {
          let xWall = parseFloat(verticesMap[yPos][0][0]) - parseFloat(verticesMap[yPos][1][0])
          if (xWall) {
            this.walls.x.push((x, z) => {
              let x0 = parseFloat(verticesMap[yPos][0][0])
              let x1 = parseFloat(verticesMap[yPos][1][0])
              let z0 = parseFloat(verticesMap[yPos][0][2])
              let distance = Math.abs(z0 - z)

              if (x0 > x1) {
                distance = (x - wallMargin > x0 || x + wallMargin < x1) ? null : distance
              } else {
                distance = (x + wallMargin < x0 || x - wallMargin > x1) ? null : distance
              }

              return distance
            })
          } else {
            this.walls.z.push((x, z) => {
              let x0 = parseFloat(verticesMap[yPos][0][0])
              let z0 = parseFloat(verticesMap[yPos][0][2])
              let z1 = parseFloat(verticesMap[yPos][1][2])
              let distance = Math.abs(x0 - x)

              if (z0 > z1) {
                distance = (z - wallMargin > z0 || z + wallMargin < z1) ? null : distance
              } else {
                distance = (z + wallMargin < z0 || z - wallMargin > z1) ? null : distance
              }

              return distance
            })
          }

        }
      }
    })
  }

  animate () {
    const timeNow = new Date().getTime()
    if (this.lastTime !== 0) {
      this.elapsed = timeNow - this.lastTime
      const newPitch = this.pitch + this.pitchRate * this.elapsed
      this.rCubeFirst += (75 * this.elapsed) / 1000
      this.rCubeSec += (75 * this.elapsed) / 1000

      if (this.speed !== 0) {
        const dX = Math.sin(this.degToRad(this.yaw)) * this.speed * this.elapsed
        const dZ = Math.cos(this.degToRad(this.yaw)) * this.speed * this.elapsed
        const newX = this.xPos - dX
        const newZ = this.zPos - dZ

        let zCollision = this.walls.x.some(straightFn => straightFn(newX, newZ) !== null && straightFn(newX, newZ) < collisionMargin)
        let xCollision = this.walls.z.some(straightFn => straightFn(newX, newZ) !== null && straightFn(newX, newZ) < collisionMargin)
        if (!xCollision){
          this.xPos = newX
        }
        if (!zCollision) {
          this.zPos = newZ
        }
        this.joggingAngle += this.elapsed * 0.6
        this.yPos = Math.sin(this.degToRad(this.joggingAngle)) / 20 + 0.4
      }

      this.yaw += this.yawRate * this.elapsed

      this.pitch = Math.abs(newPitch) <= 90 ? newPitch : this.pitch
    }
    this.lastTime = timeNow
  }

  objectTextToVertices (objectText) {
    let normalizedTriangles = []
    let verticesBuf = []
    let textureVerticesBuf = []
    objectText.split('\n').filter(line => line.indexOf('//') === -1)
      .map(line => line.split(/\s+/).filter(value => value !== ''))
      .filter(line => line.length === 5)
      .forEach((line, i) => {
        if (i !== 0 && i % 3 === 0) {
          normalizedTriangles.push({
            vertices: verticesBuf,
            textureVertices: textureVerticesBuf
          })
          verticesBuf = []
          textureVerticesBuf = []
        }

        const vertices = line.splice(0, 3)
        verticesBuf = verticesBuf.concat(vertices)
        textureVerticesBuf = textureVerticesBuf.concat(line)
      })
    return normalizedTriangles
  }

  initTexture (textureName) {
    return new Promise(resolve => {
      let texture = this.webGl.createTexture()
      texture.image = new Image()
      texture.image.src = textureName
      texture.image.onload = () => {
        this.handleLoadedTexture(texture)
        resolve(texture)
      }
    })
  }

  handleLoadedTexture (texture) {
    this.webGl.pixelStorei(this.webGl.UNPACK_FLIP_Y_WEBGL, true)
    this.webGl.bindTexture(this.webGl.TEXTURE_2D, texture)
    this.webGl.texImage2D(this.webGl.TEXTURE_2D, 0, this.webGl.RGBA, this.webGl.RGBA, this.webGl.UNSIGNED_BYTE, texture.image)
    this.webGl.texParameteri(this.webGl.TEXTURE_2D, this.webGl.TEXTURE_MAG_FILTER, this.webGl.LINEAR)
    // this.webGl.texParameteri(this.webGl.TEXTURE_2D, this.webGl.TEXTURE_MIN_FILTER, this.webGl.LINEAR)
    this.webGl.texParameteri(this.webGl.TEXTURE_2D, this.webGl.TEXTURE_MIN_FILTER, this.webGl.LINEAR_MIPMAP_NEAREST)
    this.webGl.generateMipmap(this.webGl.TEXTURE_2D)

    this.webGl.bindTexture(this.webGl.TEXTURE_2D, null)
  }

  setMatrixUniform (mvMatrix) {
    this.webGl.uniformMatrix4fv(this.currentProgram.pMatrixUniform, false, this.pMatrix)
    this.webGl.uniformMatrix4fv(this.currentProgram.mvMatrixUniform, false, mvMatrix)
    mat4.toInverseMat3(mvMatrix, this.normalMatrix)
    mat3.transpose(this.normalMatrix)
    this.webGl.uniformMatrix3fv(this.currentProgram.nMatrixUniform, false, this.normalMatrix)
  }
  getShader (gl, id) {
    let shaderScript = document.getElementById(id)
    let shader = null

    if (shaderScript) {
      let str = ''
      let k = shaderScript.firstChild
      while (k) {
        if (k.nodeType === 3) {
          str += k.textContent
        }
        k = k.nextSibling
      }

      if (shaderScript.type === 'x-shader/x-fragment') {
        shader = gl.createShader(gl.FRAGMENT_SHADER)
      } else if (shaderScript.type === 'x-shader/x-vertex') {
        shader = gl.createShader(gl.VERTEX_SHADER)
      }

      if (shader !== null) {
        gl.shaderSource(shader, str)
        gl.compileShader(shader)
      }
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        shader = null
        throw new Error(gl.getShaderInfoLog(shader))
      }
    }

    return shader
  }

  loadObject (objectName) {
    return new Promise(resolve => {
      let request = new XMLHttpRequest()
      request.open('GET', `objects/${objectName}.txt`)
      request.onreadystatechange = function () {
        if (request.readyState === 4) {
          resolve(request.responseText)
        }
      }
      request.send()
    })
  }

  // loadObjects (callback) {
  //   let request = new XMLHttpRequest()
  //   request.open('GET', 'objects/wallpaper.txt')
  //   request.onreadystatechange = function () {
  //     if (request.readyState === 4) {
  //       // handleLoadedWorld(request.responseText)
  //       callback(request.responseText)
  //     }
  //   }
  //   request.send()
  // }

  initShaders (fragmentShaderID, vertexShaderID) {
    let fragmentShader = this.getShader(this.webGl, fragmentShaderID)
    let vertexShader = this.getShader(this.webGl, vertexShaderID)
    // let shaderProgram = this.shaderProgram

    let shaderProgram = this.webGl.createProgram()
    this.webGl.attachShader(shaderProgram, vertexShader)
    this.webGl.attachShader(shaderProgram, fragmentShader)
    this.webGl.linkProgram(shaderProgram)

    if (!this.webGl.getProgramParameter(shaderProgram, this.webGl.LINK_STATUS)) {
      throw new Error('could not initialize shaders')
    }

    this.webGl.useProgram(shaderProgram)

    shaderProgram.vertexPositionAttribute = this.webGl.getAttribLocation(shaderProgram, 'aVertexPosition')
    this.webGl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute)

    shaderProgram.vertexNormalAttribute = this.webGl.getAttribLocation(shaderProgram, 'aVertexNormal')
    this.webGl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute)

    shaderProgram.textureCoordAttribute = this.webGl.getAttribLocation(shaderProgram, 'aTextureCoord')
    this.webGl.enableVertexAttribArray(shaderProgram.textureCoordAttribute)

    shaderProgram.pMatrixUniform = this.webGl.getUniformLocation(shaderProgram, 'uPMatrix')
    shaderProgram.mvMatrixUniform = this.webGl.getUniformLocation(shaderProgram, 'uMVMatrix')
    shaderProgram.nMatrixUniform = this.webGl.getUniformLocation(shaderProgram, 'uNMatrix')
    shaderProgram.samplerUniform = this.webGl.getUniformLocation(shaderProgram, 'uSampler')
    shaderProgram.useTexturesUniform = this.webGl.getUniformLocation(shaderProgram, 'uUseTextures')
    shaderProgram.useLightingUniform = this.webGl.getUniformLocation(shaderProgram, 'uUseLighting')
    shaderProgram.ambientColorUniform = this.webGl.getUniformLocation(shaderProgram, 'uAmbientColor')
    shaderProgram.pointLightingLocationUniform = this.webGl.getUniformLocation(shaderProgram, 'uPointLightingLocation')
    shaderProgram.pointLightingColorUniform = this.webGl.getUniformLocation(shaderProgram, 'uPointLightingColor')
    return shaderProgram
  }
  tick () {
    requestAnimFrame(this.tick.bind(this))
    this.handleKeys()
    this.drawScene()
    this.animate()
  }
  handleKeyDown (event) {
    this.currentlyPressedKeys[event.keyCode] = true
  }

  handleKeyUp (event) {
    this.currentlyPressedKeys[event.keyCode] = false
  }

  handleKeys () {
    if (this.currentlyPressedKeys[33]) {
      // Page Up
      this.pitchRate = 0.1
    } else if (this.currentlyPressedKeys[34]) {
      // Page Down
      this.pitchRate = -0.1
    } else {
      this.pitchRate = 0
    }

    if (this.currentlyPressedKeys[37] || this.currentlyPressedKeys[65]) {
      // Left cursor key or A
      this.yawRate = 0.1
    } else if (this.currentlyPressedKeys[39] || this.currentlyPressedKeys[68]) {
      // Right cursor key or D
      this.yawRate = -0.1
    } else {
      this.yawRate = 0
    }

    if (this.currentlyPressedKeys[38] || this.currentlyPressedKeys[87]) {
      // Up cursor key or W
      this.speed = 0.001
    } else if (this.currentlyPressedKeys[40] || this.currentlyPressedKeys[83]) {
      // Down cursor key
      this.speed = -0.001
    } else {
      this.speed = 0
    }
  }
}
